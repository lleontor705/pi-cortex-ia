import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

export interface SkillEntry {
  name: string;
  path: string;
  description: string;
  scope: "project" | "user";
}

export function getUserSkillDirs(): string[] {
  const home = homedir();
  return [
    join(home, ".pi", "agent", "skills"),
    join(home, ".pi", "skills"),
    join(home, ".config", "opencode", "skills"),
    join(home, ".agents", "skills"),
    join(home, ".claude", "skills"),
    join(home, ".gemini", "skills"),
    join(home, ".gemini", "antigravity", "skills"),
    join(home, ".cursor", "skills"),
    join(home, ".codex", "skills"),
  ];
}

export function getProjectSkillDirs(cwd: string): string[] {
  return [
    join(cwd, "skills"),
    join(cwd, ".pi", "skills"),
    join(cwd, ".opencode", "skills"),
    join(cwd, ".agents", "skills"),
    join(cwd, ".claude", "skills"),
    join(cwd, ".gemini", "skills"),
    join(cwd, ".cursor", "skills"),
    join(cwd, ".github", "skills"),
  ];
}

function parseSkillDescription(skillMdPath: string): string {
  try {
    const content = readFileSync(skillMdPath, "utf-8");
    const frontmatterMatch = content.match(/^---\s*([\s\S]*?)\s*---/);
    if (frontmatterMatch) {
      const descMatch = frontmatterMatch[1].match(/description:\s*(.+)/i);
      if (descMatch) return descMatch[1].trim();
    }
    // Fallback: first non-header line
    const lines = content.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#") && !l.startsWith("---"));
    if (lines.length > 0) return lines[0].slice(0, 150);
  } catch {
    // Ignore read errors
  }
  return "Specialized development skill";
}

export function discoverSkills(cwd: string = process.cwd()): SkillEntry[] {
  const skills: SkillEntry[] = [];
  const seen = new Set<string>();

  const scanDir = (dir: string, scope: "project" | "user") => {
    if (!existsSync(dir)) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillName = entry.name;
        if (skillName.startsWith(".") || skillName.startsWith("_")) continue;
        if (seen.has(skillName)) continue;

        const skillDir = join(dir, skillName);
        const skillMd = join(skillDir, "SKILL.md");
        if (existsSync(skillMd)) {
          seen.add(skillName);
          skills.push({
            name: skillName,
            path: skillDir,
            description: parseSkillDescription(skillMd),
            scope,
          });
        }
      }
    } catch {
      // Ignore directory read errors
    }
  };

  // Scan project first (higher precedence)
  for (const dir of getProjectSkillDirs(cwd)) {
    scanDir(dir, "project");
  }

  // Scan user second
  for (const dir of getUserSkillDirs()) {
    scanDir(dir, "user");
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

export async function syncSkillRegistry(cwd: string = process.cwd()): Promise<{ total: number; path: string }> {
  const skills = discoverSkills(cwd);
  const targetDir = join(cwd, ".cortex-ia");
  const targetFile = join(targetDir, "skill-registry.md");

  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }

  const lines: string[] = [
    "# Cortex-IA Skill Registry",
    "",
    `Last synchronized: ${new Date().toISOString()}`,
    `Total discovered skills: ${skills.length}`,
    "",
    "| Skill | Scope | Description | Location |",
    "|---|---|---|---|",
  ];

  for (const skill of skills) {
    const relPath = skill.path.startsWith(cwd) ? `.${skill.path.slice(cwd.length)}` : skill.path;
    lines.push(`| **${skill.name}** | \`${skill.scope}\` | ${skill.description} | \`${relPath}\` |`);
  }

  lines.push("");
  await writeFile(targetFile, lines.join("\n"), "utf-8");
  return { total: skills.length, path: targetFile };
}
