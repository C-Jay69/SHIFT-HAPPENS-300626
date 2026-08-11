import { pool } from '../db.js';
import { embed, fallbackVector } from './openrouter.js';

export interface KnowledgeEntry {
  id: string;
  category: string;
  question?: string;
  answer: string;
  similarity?: number;
}

/**
 * Ingest a Q&A chunk into the knowledge base. Embeds the text when an
 * embedding provider is configured; otherwise stores a deterministic
 * structural vector so the pipeline remains functional end-to-end.
 */
export async function ingestKnowledge(
  restaurantId: string,
  category: string,
  answer: string,
  question?: string,
): Promise<KnowledgeEntry> {
  const embedding = (await embed(`${question ?? ''} ${answer}`.trim())) ?? fallbackVector(answer);

  const { rows } = await pool.query(
    `INSERT INTO knowledge_base (restaurant_id, category, question, answer, embedding)
     VALUES ($1, $2, $3, $4, $5::vector)
     ON CONFLICT DO NOTHING
     RETURNING id, category, question, answer`,
    [restaurantId, category, question ?? null, answer, JSON.stringify(embedding)],
  );
  return rows[0];
}

/**
 * RAG retrieval: embed the query and cosine-search the knowledge base.
 * Falls back to full-text keyword search when embeddings are unavailable or
 * the vector operator is unsupported.
 */
export async function searchKnowledgeBase(
  restaurantId: string,
  query: string,
  topK = 5,
): Promise<KnowledgeEntry[]> {
  const embedding = await embed(query);
  if (embedding) {
    try {
      const { rows } = await pool.query(
        `SELECT id, category, question, answer,
                (1 - (embedding <=> $1::vector)) AS similarity
           FROM knowledge_base
          WHERE restaurant_id = $2
          ORDER BY embedding <=> $1::vector
          LIMIT $3`,
        [JSON.stringify(embedding), restaurantId, topK],
      );
      if (rows.length > 0) return rows;
    } catch (err) {
      console.warn('Vector search unavailable, falling back to keyword:', err);
    }
  }

  const { rows } = await pool.query(
    `SELECT id, category, question, answer, 0 AS similarity
       FROM knowledge_base
      WHERE restaurant_id = $1
        AND to_tsvector('english', answer) @@ plainto_tsquery('english', $2)
      ORDER BY created_at DESC
      LIMIT $3`,
    [restaurantId, query, topK],
  );
  return rows;
}
