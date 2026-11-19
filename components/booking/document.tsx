import Link from "next/link";
import type { ReactNode } from "react";

/** Readable layout for legal text: one column of at most 70 characters (DESIGN.md §3). */
export function DocumentPage({
  back,
  title,
  meta,
  children,
}: {
  back: { href: string; label: string; display?: boolean };
  title: string;
  /** One quiet line under the title, e.g. the effective date. */
  meta?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh px-4 pt-safe pb-safe sm:px-8">
      <article className="mx-auto flex w-full max-w-[70ch] flex-col py-8 sm:py-14">
        <Link
          href={back.href}
          className={
            back.display
              ? "inline-flex min-h-11 items-center self-start font-display text-[1.375rem] leading-none text-plum"
              : "inline-flex min-h-11 items-center self-start text-sm font-medium text-plum underline-offset-4 hover:underline"
          }
        >
          {back.label}
        </Link>
        <h1 className="mt-8 font-display text-[1.75rem] leading-tight text-balance sm:text-[2.25rem]">{title}</h1>
        {meta && <p className="mt-2 text-ink-soft">{meta}</p>}
        <div className="mt-6 [&_a]:text-plum [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[1.125rem] [&_h2]:leading-snug [&_h2]:font-medium [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-medium [&_li]:mb-2 [&_li]:pl-1 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </article>
    </main>
  );
}

const BULLET = /^[•\-–]\s*/;
const HEADING = /^\d+\.\s+\S/;

/**
 * Renders a plain-text policy (the business's own text or the generated default):
 * blank lines split blocks, "1. Título" lines become headings, "•" lines become lists.
 */
export function PolicyText({ blocks }: { blocks: string[][] }) {
  return blocks.map((lines, index) => {
    const heading = HEADING.test(lines[0]) && lines[0].length <= 80 ? lines[0] : null;
    const body = heading ? lines.slice(1) : lines;
    const groups: (string | string[])[] = [];
    for (const line of body) {
      if (BULLET.test(line)) {
        const last = groups[groups.length - 1];
        const item = line.replace(BULLET, "");
        if (Array.isArray(last)) last.push(item);
        else groups.push([item]);
      } else {
        groups.push(line);
      }
    }
    return (
      <section key={index}>
        {heading && <h2>{heading}</h2>}
        {groups.map((group, i) =>
          Array.isArray(group) ? (
            <ul key={i}>
              {group.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{group}</p>
          ),
        )}
      </section>
    );
  });
}

/** Splits a policy into blocks of trimmed, non-empty lines. */
export function policyBlocks(text: string): string[][] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length > 0);
}
