"use client";

import { ExternalLink, Instagram } from "lucide-react";
import Image from "next/image";

type AppHeaderProps = {
  appName: string;
  hasLogo: boolean;
};

export default function AppHeader({ appName, hasLogo }: AppHeaderProps) {
  return (
    <header className="overflow-hidden rounded-lg border border-blue-100 bg-white shadow-editorial">
      <div className="h-1.5 bg-gradient-to-r from-leste-blue via-leste-gold to-leste-blue" />

      <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            {hasLogo ? (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-blue-100 bg-white">
                <Image alt={appName} fill sizes="56px" src="/logo.png" className="object-contain p-2" />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-lg bg-leste-blue text-white">
                <span className="text-[10px] font-black leading-none">LESTE</span>
                <span className="mt-1 text-[10px] font-black leading-none text-leste-gold">
                  VALLEY
                </span>
              </div>
            )}

            <div>
              <p className="text-xs font-black uppercase text-leste-blue">
                Leste Valley
              </p>
              <h1 className="mt-2 text-3xl font-black text-slate-950 sm:text-4xl">
                {appName}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                Ferramenta do Leste Valley para transcrever áudios do WhatsApp, organizar
                informações e transformar conversas em conteúdo útil.
              </p>
            </div>
          </div>
        </div>

        <a
          className="group inline-flex w-full items-center justify-between gap-4 rounded-lg border border-leste-blue bg-leste-blue px-4 py-4 text-white transition hover:bg-blue-950 sm:w-auto sm:min-w-80"
          href="https://www.instagram.com/lestevalley/"
          rel="noreferrer"
          target="_blank"
        >
          <span className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-leste-blue">
              <Instagram className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-xs font-black uppercase text-leste-gold">
                Conheça Leste Valley
              </span>
              <span className="mt-1 block text-base font-bold">@lestevalley</span>
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 opacity-80 transition group-hover:translate-x-0.5" />
        </a>
      </div>
    </header>
  );
}
