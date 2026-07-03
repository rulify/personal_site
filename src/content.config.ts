import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// §8 content model: one taxonomy. Categories are fixed module-style labels;
// tags are flat, lowercase in data, rendered uppercase by label-xs.
const posts = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(["SEC", "BOX", "MAKE"]),
    date: z.coerce.date(),
    readTime: z.string(),
    tags: z.array(z.string()).default([]),
  }),
});

// Projects: same card anatomy as posts, meta shows status instead of read time.
const projects = defineCollection({
  loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /* fixed vocabulary so the status→hazard-token mapping stays total */
    status: z.enum(["ACTIVE", "WIP", "DONE", "ARCHIVED"]),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { posts, projects };
