/* ── R24 (security) — pinned, bundled vendors.
   Replaces the floating CDN tags (<script src=".../@supabase/supabase-js@2">, ".../chart.js@4">)
   that auto-upgraded on every deploy — a supply-chain risk (unpinned third-party code, no SRI).
   Versions are pinned exactly in package.json + package-lock.json and compiled into our own
   bundle, so the only runtime third-party script left is the pinned Tailwind CDN build.
   This module MUST stay the FIRST import in src/main.js — everything else expects the globals. */
import * as _supabase from '@supabase/supabase-js';
import Chart from 'chart.js/auto';
window.supabase = _supabase;
window.Chart = Chart;
