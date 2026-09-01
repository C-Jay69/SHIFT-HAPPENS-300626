import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api.ts';
import { GraduationCap, Plus, Trash2, RefreshCw, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  category: string;
  description: string | null;
  duration_min: number;
  required: boolean;
  quiz: { q: string; options: string[]; answer: number }[];
  enrolled: number;
  completed: number;
}

interface OverviewStaff {
  staff_id: string;
  name: string;
  role: string;
  enrolled: number;
  completed: number;
  avg_progress: number;
  required_gaps: string[];
  in_progress: { course: string; progress: number; score: number | null }[];
}

interface Overview {
  staff: OverviewStaff[];
  compliance: { required_courses: number; headcount: number; required_slots: number; required_completed: number; compliance_pct: number };
}

const CAT_STYLE: Record<string, string> = {
  safety: 'bg-red-50 text-red-700 border-red-200',
  pos: 'bg-blue-50 text-blue-700 border-blue-200',
  service: 'bg-purple-50 text-purple-700 border-purple-200',
  management: 'bg-amber-50 text-amber-700 border-amber-200',
  custom: 'bg-gray-50 text-gray-600 border-gray-200',
};

const TrainingPanel = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [staffOptions, setStaffOptions] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [courseForm, setCourseForm] = useState({ title: '', category: 'safety', durationMin: 30, required: false });
  const [enrollForm, setEnrollForm] = useState({ staffId: '', courseId: '' });
  const [progressFor, setProgressFor] = useState<{ staffId: string; staffName: string; course: Course } | null>(null);
  const [progressPct, setProgressPct] = useState(50);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, o] = await Promise.all([
      api.get<Course[]>('/training/courses').catch(() => []),
      api.get<Overview>('/training/overview').catch(() => null),
    ]);
    setCourses(c);
    setOverview(o);
    setStaffOptions((o?.staff ?? []).map((s) => ({ id: s.staff_id, name: s.name })));
    setEnrollForm((f) => ({
      staffId: f.staffId || staffOptions[0]?.id || o?.staff?.[0]?.staff_id || '',
      courseId: f.courseId || c[0]?.id || '',
    }));
    setLoading(false);
  }, [staffOptions]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addCourse = async () => {
    if (courseForm.title.trim().length < 2) return alert('Give the course a title');
    await api.post('/training/courses', {
      title: courseForm.title,
      category: courseForm.category,
      duration_min: Number(courseForm.durationMin),
      required: courseForm.required,
      quiz: [],
    }).catch((e) => alert((e as Error).message));
    setCourseForm({ ...courseForm, title: '' });
    load();
  };

  const deleteCourse = async (c: Course) => {
    if (!window.confirm(`Delete course "${c.title}"?`)) return;
    await api.delete(`/training/courses/${c.id}`).catch((e) => alert((e as Error).message));
    load();
  };

  const enroll = async () => {
    if (!enrollForm.staffId || !enrollForm.courseId) return alert('Pick a staff member and a course');
    await api.post('/training/enroll', enrollForm).catch((e) => alert((e as Error).message));
    load();
  };

  const openProgress = (staffId: string, staffName: string, course: Course) => {
    setProgressFor({ staffId, staffName, course });
    setProgressPct(50);
    setQuizAnswers({});
  };

  const saveProgress = async (withQuiz: boolean) => {
    if (!progressFor) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        staffId: progressFor.staffId,
        courseId: progressFor.course.id,
        progress: progressPct,
      };
      if (withQuiz) {
        const qs = progressFor.course.quiz;
        if (qs.length && Object.keys(quizAnswers).length < qs.length) {
          alert('Answer all quiz questions first');
          return;
        }
        body.quizResult = qs.map((_, i) => quizAnswers[i]);
      }
      const r = await api.post<{ completed_at: string | null; score: number | null }>('/training/progress', body);
      if (r.completed_at) alert(`Completed! Score: ${r.score ?? '—'}%`);
      setProgressFor(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy(false);
  };

  const inProgressFor = (staffId: string, courseId: string) =>
    overview?.staff.find((s) => s.staff_id === staffId)?.in_progress.find((i) => i.course === courses.find((c) => c.id === courseId)?.title);

  return (
    <div className="space-y-4">
      {/* Compliance header */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Required courses', value: overview?.compliance.required_courses ?? '—' },
          { label: 'Required completions', value: overview ? `${overview.compliance.required_completed}/${overview.compliance.required_slots}` : '—' },
          { label: 'Team compliance', value: overview ? `${overview.compliance.compliance_pct}%` : '—', accent: (overview?.compliance.compliance_pct ?? 100) >= 80 ? 'text-green-600' : 'text-red-600' },
          { label: 'Courses', value: courses.length },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <p className="text-[10px] font-bold uppercase text-gray-400">{c.label}</p>
            <p className={`text-2xl font-bold mt-1 ${c.accent ?? 'text-shift-dark'}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Staff progress */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2"><GraduationCap size={16} className="text-shift-blue" /> Staff Progress</h3>
            <button onClick={load} className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} className="text-gray-500" />}
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {(overview?.staff ?? []).map((s) => (
              <div key={s.staff_id} className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm">{s.name} <span className="text-xs text-gray-400 font-normal capitalize">· {s.role}</span></p>
                    <p className="text-[11px] text-gray-400">{s.completed}/{s.enrolled || 0} courses done · avg {s.avg_progress}%</p>
                  </div>
                  {s.required_gaps.length > 0 ? (
                    <span className="text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded-full flex items-center gap-1">
                      <AlertTriangle size={10} /> {s.required_gaps.length} required missing
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={10} /> Fully compliant
                    </span>
                  )}
                </div>
                {s.required_gaps.length > 0 && (
                  <p className="text-[11px] text-red-600 mb-2">Missing: {s.required_gaps.join(', ')}</p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {courses.map((c) => {
                    const done = !s.required_gaps.includes(c.title) && (inProgressFor(s.staff_id, c.id) === undefined);
                    const ip = inProgressFor(s.staff_id, c.id);
                    const enrolled = ip || done;
                    if (!enrolled) return null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => openProgress(s.staff_id, s.name, c)}
                        title="Update progress / take quiz"
                        className={`text-[11px] font-bold px-2 py-1 rounded-full border transition-colors ${
                          done
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        {done ? '✓ ' : `${ip?.progress ?? 0}% `}{c.title}
                      </button>
                    );
                  })}
                  {courses.every((c) => !inProgressFor(s.staff_id, c.id) && s.enrolled === 0) && (
                    <span className="text-[11px] text-gray-300">not enrolled in anything yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Courses + enrollment */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold mb-3">Courses</h3>
            <div className="space-y-2 mb-4">
              {courses.map((c) => (
                <div key={c.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{c.title}</p>
                    <p className="text-[10px] text-gray-400">
                      <span className={`inline-block font-bold px-1.5 py-0.5 rounded border ${CAT_STYLE[c.category] ?? CAT_STYLE.custom}`}>{c.category}</span>
                      {' '}{c.duration_min} min{c.required && ' · REQUIRED'}{c.quiz.length > 0 ? ` · quiz (${c.quiz.length} q)` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-gray-400 font-mono">{c.completed}/{c.enrolled} done</span>
                    <button onClick={() => deleteCourse(c)} className="p-1.5 bg-gray-50 text-gray-400 rounded-md hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {courses.length === 0 && <p className="text-sm text-gray-300 text-center py-4">No courses yet.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="New course title" value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} className="col-span-2 px-3 py-2 text-sm border border-gray-200 rounded-lg" />
              <select value={courseForm.category} onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
                <option value="safety">Safety</option>
                <option value="pos">POS</option>
                <option value="service">Service</option>
                <option value="management">Management</option>
                <option value="custom">Custom</option>
              </select>
              <div className="flex gap-2">
                <input type="number" min={5} max={480} value={courseForm.durationMin} onChange={(e) => setCourseForm({ ...courseForm, durationMin: Number(e.target.value) })} className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg" title="Duration (min)" />
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 px-2">
                  <input type="checkbox" checked={courseForm.required} onChange={(e) => setCourseForm({ ...courseForm, required: e.target.checked })} />
                  Req.
                </label>
              </div>
              <button onClick={addCourse} className="col-span-2 py-2 bg-shift-blue text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
                <Plus size={14} /> Add Course
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-bold mb-3 text-sm">Enroll Staff</h3>
            <div className="flex gap-2">
              <select value={enrollForm.staffId} onChange={(e) => setEnrollForm({ ...enrollForm, staffId: e.target.value })} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                {staffOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={enrollForm.courseId} onChange={(e) => setEnrollForm({ ...enrollForm, courseId: e.target.value })} className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg">
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button onClick={enroll} className="px-4 py-2 bg-shift-dark text-white text-sm font-bold rounded-lg hover:bg-black">Enroll</button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress / quiz modal */}
      {progressFor && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold">{progressFor.course.title}</h3>
                <p className="text-xs text-gray-400">{progressFor.staffName}</p>
              </div>
              <button onClick={() => setProgressFor(null)} className="p-2 hover:bg-gray-100 rounded-full">✕</button>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Progress: {progressPct}%</label>
              <input type="range" min={0} max={100} step={10} value={progressPct} onChange={(e) => setProgressPct(Number(e.target.value))} className="w-full accent-blue-600" />
            </div>

            {progressFor.course.quiz.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Quiz (pass ≥ 70%)</p>
                {progressFor.course.quiz.map((q, qi) => (
                  <div key={qi} className="border border-gray-100 rounded-xl p-3">
                    <p className="text-sm font-bold mb-2">{qi + 1}. {q.q}</p>
                    <div className="space-y-1">
                      {q.options.map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name={`q-${qi}`}
                            checked={quizAnswers[qi] === oi}
                            onChange={() => setQuizAnswers({ ...quizAnswers, [qi]: oi })}
                            className="accent-blue-600"
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={() => saveProgress(false)} disabled={busy} className="flex-1 py-2.5 border border-gray-200 text-sm font-bold rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Save Progress
              </button>
              {progressFor.course.quiz.length > 0 && (
                <button onClick={() => saveProgress(true)} disabled={busy} className="flex-1 py-2.5 bg-shift-blue text-white text-sm font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {busy ? <Loader2 size={14} className="animate-spin inline" /> : 'Submit Progress + Quiz'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrainingPanel;
