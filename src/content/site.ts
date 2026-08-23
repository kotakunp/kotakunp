export const socialLinks = [
  { label: "YouTube", icon: "video", href: "https://www.youtube.com/@kotakunp" },
  { label: "Facebook", icon: "users", href: null },
  { label: "Spotify", icon: "disc", href: null },
  { label: "Apple Music", icon: "music", href: null },
  { label: "Instagram", icon: "camera", href: null },
  { label: "duu.to", icon: "link", href: null },
] as const;

export const projects = [
  { name: "ktscript", icon: "braces", category: "tools", status: "active", description: "A lightweight scripting language for music and creative coding.", tags: ["language", "cli", "music"] },
  { name: "yorisan", icon: "sliders", category: "plugins", status: "active", description: "Vocaloid editor toolkit and workflow extensions.", tags: ["vocaloid", "editor", "toolkit"] },
  { name: "kotautil", icon: "wrench", category: "utilities", status: "active", description: "A collection of CLI tools and utilities for producers.", tags: ["cli", "utilities", "audio"] },
  { name: "midipipe", icon: "waveform", category: "tools", status: "active", description: "MIDI routing and processing toolkit for automation.", tags: ["midi", "routing", "cli"] },
  { name: "gridseq", icon: "grid", category: "experiments", status: "beta", description: "A terminal step sequencer and pattern generator.", tags: ["sequencer", "terminal", "music"] },
  { name: "audiosnap", icon: "scan", category: "libraries", status: "active", description: "Audio slicing and transient analysis library.", tags: ["audio", "dsp", "analysis"] },
  { name: "vstbridge", icon: "plug", category: "plugins", status: "alpha", description: "Minimal bridge utilities for plugin hosting.", tags: ["plugin", "host", "cross-platform"] },
  { name: "livecode", icon: "code", category: "experiments", status: "beta", description: "Live-coding playground for music and visuals.", tags: ["livecoding", "osc", "visuals"] },
] as const;

export const experience = [
  { period: "2024 — present", role: "Independent producer & developer", description: "Creating Vocaloid music, visual worlds, and small tools for creative workflows." },
  { period: "2023 — 2024", role: "Open-source contributor", description: "Contributed to developer tooling and libraries focused on music production." },
  { period: "2022 — 2023", role: "Software developer", description: "Built backend services and internal tools in a small product team." },
] as const;

export const skills = ["Vocaloid / Synthesizer V", "Music production", "TypeScript", "Rust", "Python", "C#", "Web development", "CLI tools", "Git", "Linux"] as const;
