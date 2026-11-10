<script setup lang="ts">
// The live preview — the non-negotiable core of the editor. Renders REAL
// shadcn components, re-skinned by the SAME themeCssScoped mechanism the app
// uses everywhere else (see preview-theme.ts), scoped to this panel alone so
// an in-progress edit never repaints the real dashboard chrome behind the
// sheet. The light/dark toggle here is local to the preview — independent of
// whatever mode the rest of the app is actually in — exactly like tweakcn's
// own preview toggle.
import { computed, useId } from "vue";
import { MoonIcon, SunIcon } from "@lucide/vue";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { themeCssScoped } from "@/lib/theme/theme-css";
import { draftToPreviewTheme } from "./preview-theme";
import type { SkinPayloadDraft } from "@/lib/theme/skin-submit";

const props = defineProps<{
  draft: SkinPayloadDraft;
  dark: boolean;
  onDarkChange: (dark: boolean) => void;
}>();

const CHART_DATA = [
  { name: "Mon", value: 12 },
  { name: "Tue", value: 19 },
  { name: "Wed", value: 9 },
  { name: "Thu", value: 24 },
  { name: "Fri", value: 17 },
];
const CHART_MAX = Math.max(...CHART_DATA.map((d) => d.value));

const scopeClass = `skin-preview-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

const css = computed(() => themeCssScoped(draftToPreviewTheme(props.draft), `.${scopeClass}`));
</script>

<template>
  <div class="flex h-full flex-col gap-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-muted-foreground">Live preview</span>
      <div class="flex items-center gap-1.5">
        <SunIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
        <Switch :model-value="dark" aria-label="Toggle dark preview" size="sm" @update:model-value="(v) => onDarkChange(Boolean(v))" />
        <MoonIcon class="size-3.5 text-muted-foreground" aria-hidden="true" />
      </div>
    </div>

    <!-- Scoped theme vars — same mechanism as theme-css.ts's themeCss, just a
         different selector so it never touches :root/.dark for real. -->
    <component :is="'style'" v-html="css" />

    <div
      :class="[scopeClass, dark ? 'dark' : '', 'min-h-0 flex-1 space-y-4 overflow-y-auto rounded-lg border p-4']"
      :style="{ background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }"
    >
      <div>
        <h3 class="text-lg font-semibold" :style="{ fontFamily: 'var(--font-display)' }">Preview heading</h3>
        <p class="text-sm" :style="{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-serif)' }">
          This is how a reply reads in the reading/serif face, at the letter-spacing you&rsquo;ve set.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <Button size="sm">Primary</Button>
        <Button size="sm" variant="secondary">Secondary</Button>
        <Button size="sm" variant="outline">Outline</Button>
        <Button size="sm" variant="ghost">Ghost</Button>
        <Button size="sm" variant="destructive">Destructive</Button>
        <Button size="sm" variant="link">Link</Button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Toggle size="sm" :model-value="true" aria-label="Sample toggle">Toggle</Toggle>
      </div>

      <Card :style="{ background: 'var(--card)', color: 'var(--card-foreground)', borderRadius: 'var(--radius)' }">
        <CardHeader>
          <CardTitle>Agent card</CardTitle>
          <CardDescription>Sample card content, sample radius.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3">
          <div class="space-y-1.5">
            <Label for="skin-preview-input">Name</Label>
            <Input id="skin-preview-input" placeholder="Type something…" />
          </div>
          <div class="rounded-md p-3 text-sm" :style="{ background: 'var(--agent-surface)', fontFamily: 'var(--font-serif)' }">
            Agent message surface — a hair off the page background.
          </div>
        </CardContent>
      </Card>

      <Tabs default-value="one">
        <TabsList>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
        <TabsContent value="one" class="text-sm text-muted-foreground">
          Tab content, styled by the draft&rsquo;s tokens.
        </TabsContent>
        <TabsContent value="two" class="text-sm text-muted-foreground">
          Switching tabs re-uses the same accent/muted tokens.
        </TabsContent>
      </Tabs>

      <!-- Was a recharts bar chart; plain divs styled with the chart token. -->
      <div class="flex h-32 w-full flex-col text-xs" role="img" aria-label="Messages per weekday">
        <div class="relative flex min-h-0 flex-1 items-end gap-2 px-1">
          <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
            <div v-for="i in 4" :key="i" class="border-t border-dashed border-border" />
          </div>
          <div
            v-for="d in CHART_DATA"
            :key="d.name"
            class="relative flex-1 rounded-t-[4px]"
            :style="{ height: `${(d.value / CHART_MAX) * 100}%`, background: 'var(--chart-1)' }"
            :title="`${d.name}: ${d.value}`"
          />
        </div>
        <div class="flex gap-2 px-1 pt-1.5 text-muted-foreground">
          <span v-for="d in CHART_DATA" :key="d.name" class="flex-1 text-center">{{ d.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
