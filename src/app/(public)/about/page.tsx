import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Me",
};

export default function AboutPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-5xl flex-col px-6 py-10">
      <div>
        <h1 className="font-[family-name:var(--font-mother-display)] text-4xl font-semibold tracking-tight text-[var(--mt-ink)]">
          About Me
        </h1>
        <div className="mt-6 max-w-2xl space-y-4 text-[#3d2a22] leading-relaxed">
          <p>Hi, I&apos;m Aurora, the creator behind this project.</p>
          <p>
            This project started because someone asked for a list of Aliemus
            Batteries. It sounded simple until I tried writing the list. I
            started questioning what qualifies as an Aliemus Battery. Is it the
            amount provided? The number of Awakeners targeted?
          </p>
          <p>
            Defining it proved to be surprisingly difficult, so I chose a
            different approach. Rather than imposing my own definition, I built
            a database cataloging every Aliemus source in Morimens so players
            could query the data and decide for themselves.
          </p>
          <p>
            Before long, that expanded into cataloging every other stat in the
            game. With that much data, it would be a waste not to process it to
            produce something meaningful.
          </p>
          <p>
            From there, scope creep took over. What started as a simple list has
            evolved into a system designed to break down Morimens&apos; core
            mechanics, with the ultimate goal of rendering all team-building
            channels obsolete.
          </p>
          <p>
            Root Version focuses on Morimens&apos; data and the basics of how
            the game functions. It cannot build teams yet. However, future
            versions will.
          </p>
          <div className="space-y-3">
            <p>Tick-tock team-building channels, your days are numbered.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/emotes/Juliette_Pat.webp"
              alt=""
              width={96}
              height={96}
              className="size-20 select-none sm:size-24"
              aria-hidden
            />
          </div>
        </div>
      </div>
      <p className="mt-auto pt-10 max-w-2xl text-[#3d2a22] leading-relaxed">
        Contact:{" "}
        <a
          href="https://discord.com/users/452731110556696596"
          className="font-medium text-[var(--mt-ember)] underline underline-offset-4 hover:text-[var(--mt-ember-deep)]"
          target="_blank"
          rel="noopener noreferrer"
        >
          Discord
        </a>
      </p>
    </div>
  );
}
