import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

// Build-time search index: fetched when the header search first opens.
export const GET: APIRoute = async () => {
  const posts = await getCollection("posts");
  const projects = await getCollection("projects");

  const index = [
    ...posts.map((p) => ({
      title: p.data.title,
      url: `/posts/${p.id}`,
      category: p.data.category,
      tags: p.data.tags,
    })),
    ...projects.map((p) => ({
      title: p.data.title,
      url: `/projects/${p.id}`,
      category: "PROJECT",
      tags: p.data.tags,
    })),
  ];

  return new Response(JSON.stringify(index), {
    headers: { "Content-Type": "application/json" },
  });
};
