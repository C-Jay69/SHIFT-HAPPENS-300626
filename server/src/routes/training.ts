import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { requireAuth, currentUser } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

const router = Router();
router.use(requireAuth);

/**
 * Training System
 * ---------------
 * Courses (with JSONB multiple-choice quiz), per-staff enrollments, progress
 * updates, quiz scoring, and team compliance on required courses.
 */

interface QuizQuestion {
  q: string;
  options: string[];
  answer: number;
}

const quizSchema = z.array(
  z.object({
    q: z.string().min(3).max(500),
    options: z.array(z.string().min(1).max(200)).min(2).max(6),
    answer: z.number().int().min(0),
  }),
).default([]);

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

router.get('/courses', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
              (SELECT count(*)::int FROM training_enrollments e WHERE e.course_id = c.id) AS enrolled,
              (SELECT count(*)::int FROM training_enrollments e WHERE e.course_id = c.id AND e.completed_at IS NOT NULL) AS completed
         FROM training_courses c ORDER BY c.required DESC, c.title`,
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

const courseSchema = z.object({
  title: z.string().min(2).max(120),
  category: z.enum(['safety', 'pos', 'service', 'management', 'custom']).default('custom'),
  description: z.string().max(1000).optional(),
  duration_min: z.number().int().min(5).max(480).default(30),
  required: z.boolean().default(false),
  quiz: quizSchema,
});

router.post('/courses', async (req, res, next) => {
  try {
    const body = courseSchema.parse(req.body);
    // Guard quiz answer indices.
    for (const q of body.quiz) {
      if (q.answer >= q.options.length) throw new ApiError(400, `Quiz answer index out of range: "${q.q.slice(0, 30)}"`);
    }
    const { rows } = await pool.query(
      `INSERT INTO training_courses (title, category, description, duration_min, required, quiz)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [body.title, body.category, body.description ?? null, body.duration_min, body.required, JSON.stringify(body.quiz)],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/courses/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`DELETE FROM training_courses WHERE id = $1 RETURNING id`, [req.params.id]);
    if (!rows[0]) throw new ApiError(404, 'Course not found');
    res.json({ deleted: rows[0].id });
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Enrollment + progress
// ---------------------------------------------------------------------------

router.post('/enroll', async (req, res, next) => {
  try {
    const body = z.object({ staffId: z.string().uuid(), courseId: z.string().uuid() }).parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO training_enrollments (staff_id, course_id)
       VALUES ($1, $2)
       ON CONFLICT (staff_id, course_id) DO NOTHING
       RETURNING *`,
      [body.staffId, body.courseId],
    );
    if (!rows[0]) {
      // Already enrolled — return the existing row.
      const { rows: existing } = await pool.query(
        `SELECT * FROM training_enrollments WHERE staff_id = $1 AND course_id = $2`,
        [body.staffId, body.courseId],
      );
      res.json(existing[0]);
      return;
    }
    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.post('/progress', async (req, res, next) => {
  try {
    const body = z
      .object({
        staffId: z.string().uuid(),
        courseId: z.string().uuid(),
        progress: z.number().int().min(0).max(100),
        quizResult: z.array(z.number().int().min(0)).optional(),
      })
      .parse(req.body);

    const { rows: courseRows } = await pool.query(`SELECT quiz FROM training_courses WHERE id = $1`, [body.courseId]);
    if (!courseRows[0]) throw new ApiError(404, 'Course not found');

    let score: number | null = null;
    if (body.quizResult) {
      const quiz = (courseRows[0].quiz ?? []) as QuizQuestion[];
      if (body.quizResult.length !== quiz.length) {
        throw new ApiError(400, `Quiz has ${quiz.length} question(s), got ${body.quizResult.length} answer(s)`);
      }
      let correct = 0;
      quiz.forEach((qq, i) => {
        if (body.quizResult![i] === qq.answer) correct += 1;
      });
      score = Math.round((correct / quiz.length) * 100);
    }

    // Completion: 100% progress AND (no quiz OR score >= 70).
    const passing = score === null ? true : score >= 70;
    const complete = body.progress >= 100 && passing;

    const { rows } = await pool.query(
      `INSERT INTO training_enrollments (staff_id, course_id, progress, score, completed_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (staff_id, course_id)
       DO UPDATE SET progress = EXCLUDED.progress,
                    score = COALESCE(EXCLUDED.score, training_enrollments.score),
                    completed_at = EXCLUDED.completed_at
       RETURNING *`,
      [body.staffId, body.courseId, body.progress, score, complete ? new Date() : null],
    );
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// ---------------------------------------------------------------------------
// Team overview + compliance
// ---------------------------------------------------------------------------

router.get('/overview', async (req, res, next) => {
  try {
    const user = currentUser(req);
    const { rows: staff } = await pool.query(
      `SELECT id, first_name, last_name, role FROM staff
        WHERE restaurant_id = $1 AND status <> 'terminated' ORDER BY first_name`,
      [user.restaurantId],
    );
    const { rows: courses } = await pool.query(`SELECT id, title, required FROM training_courses`);
    const { rows: enr } = await pool.query(
      `SELECT staff_id, course_id, progress, score, completed_at FROM training_enrollments
        WHERE staff_id IN (SELECT id FROM staff WHERE restaurant_id = $1)`,
      [user.restaurantId],
    );

    const required = courses.filter((c) => c.required);
    const byStaff = new Map<string, typeof enr>();
    for (const e of enr) {
      byStaff.set(e.staff_id, [...(byStaff.get(e.staff_id) ?? []), e]);
    }

    const out = staff.map((s) => {
      const mine = byStaff.get(s.id) ?? [];
      const completedIds = new Set(mine.filter((e) => e.completed_at).map((e) => e.course_id));
      const gaps = required.filter((c) => !completedIds.has(c.id)).map((c) => c.title);
      const inProgress = mine
        .filter((e) => !e.completed_at)
        .map((e) => ({
          course: courses.find((c) => c.id === e.course_id)?.title ?? 'Unknown',
          progress: e.progress,
          score: e.score,
        }));
      const avgProgress = mine.length
        ? Math.round(mine.reduce((a, e) => a + (e.completed_at ? 100 : e.progress), 0) / mine.length)
        : 0;
      return {
        staff_id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        role: s.role,
        enrolled: mine.length,
        completed: mine.filter((e) => e.completed_at).length,
        avg_progress: avgProgress,
        required_gaps: gaps,
        in_progress: inProgress,
      };
    });

    const requiredSlots = out.length * required.length;
    const requiredDone = out.reduce((a, s) => a + (required.length - s.required_gaps.length), 0);
    res.json({
      staff: out,
      compliance: {
        required_courses: required.length,
        headcount: out.length,
        required_slots: requiredSlots,
        required_completed: requiredDone,
        compliance_pct: requiredSlots ? Math.round((requiredDone / requiredSlots) * 100) : 100,
      },
    });
  } catch (e) {
    next(e);
  }
});

export const trainingRouter = router;
