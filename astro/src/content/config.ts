import { defineCollection, z } from 'astro:content';

const base = z.object({
  title: z.string(),
  date: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  demo: z.boolean().optional(),
  description: z.string().optional(),
  cover: z.string().optional(),
  tags: z.array(z.string()).default([]),
  author: z.string().optional(),
  featured: z.boolean().optional().default(false),
  noindex: z.boolean().optional(),
});

const reviews = defineCollection({
  type: 'content',
  schema: base.extend({
    rating: z.number().optional(),
    specs: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
    verdict: z.string().optional(),
  }),
});

const editorial = defineCollection({ type: 'content', schema: base });

const insurance = defineCollection({
  type: 'content',
  schema: base.extend({
    question: z.string().optional(),
    short_answer: z.string().optional(),
    section_labels: z.record(z.string()).optional(),
    causes: z.array(z.string()).optional(),
    steps: z.array(z.object({ title: z.string(), detail: z.string() })).optional(),
    when_to_see_mechanic: z.array(z.string()).optional(),
    buying_tips: z.array(z.string()).optional(),
    tables: z
      .array(
        z.object({
          title: z.string(),
          note: z.string().optional(),
          headers: z.array(z.string()),
          rows: z.array(z.array(z.string())),
          verdict: z.string().optional(),
        })
      )
      .optional(),
    faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: base.extend({
    layout: z.string().optional(),
  }),
});

export const collections = {
  reviews,
  insurance,
  pages,
  news: editorial,
  culture: editorial,
  electric: editorial,
  guides: editorial,
  blog: editorial,
  gear: editorial,
};
