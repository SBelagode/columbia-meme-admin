// Plain module (not "use client") so both Server and Client Components can read it.
export const ADMIN_NAV_GROUPS = [
  {
    label: null,
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/profiles", label: "Users" },
      { href: "/admin/generations", label: "Generated media" },
      { href: "/admin/votes", label: "Votes" },
      { href: "/admin/images", label: "Images" },
    ],
  },
  {
    label: "Prompting",
    items: [
      { href: "/admin/prompt-chains", label: "Prompt chains" },
      { href: "/admin/prompt-chain-mix", label: "Prompt chain mix" },
      { href: "/admin/terms", label: "Terms" },
      { href: "/admin/generation-examples", label: "Generation examples" },
    ],
  },
  {
    label: "LLM",
    items: [
      { href: "/admin/generation-requests", label: "Generation requests" },
      { href: "/admin/llm-responses", label: "LLM responses" },
      { href: "/admin/llm-models", label: "LLM models" },
      { href: "/admin/llm-providers", label: "LLM providers" },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/admin/allowed-signup-domains", label: "Allowed signup domains" },
      { href: "/admin/whitelisted-emails", label: "Whitelisted emails" },
    ],
  },
] as const;
