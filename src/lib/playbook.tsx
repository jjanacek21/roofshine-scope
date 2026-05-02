// Roof Kings cold-call playbook — verbatim content from the company sales guide.
// Used by both the Training Center (full library) and the floating on-call panel.

import * as React from "react";

export type PlaybookColor =
  | "blue"
  | "green"
  | "red"
  | "purple"
  | "cyan"
  | "amber"
  | "indigo"
  | "pink"
  | "yellow";

export interface PlaybookSection {
  id: string; // unique within category
  title: string;
  body: string; // supports **bold**, *em*, line breaks via whitespace-pre-line
}

export interface PlaybookCategory {
  id: string;
  title: string;
  emoji: string;
  color: PlaybookColor;
  sections: PlaybookSection[];
}

// CSS color tokens for category accents (kept aligned with status palette).
export const PLAYBOOK_COLOR_HEX: Record<PlaybookColor, string> = {
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#a855f7",
  cyan: "#06b6d4",
  amber: "#f59e0b",
  indigo: "#6366f1",
  pink: "#ec4899",
  yellow: "#eab308",
};

export const DEFAULT_PLAYBOOK_SELECTION = ["quickRef", "rebuttals", "masterScript"];

export const PLAYBOOK: PlaybookCategory[] = [
  {
    id: "philosophy",
    title: "The Philosophy",
    emoji: "🧠",
    color: "blue",
    sections: [
      {
        id: "voices",
        title: "Three Voices to Channel",
        body:
          "Belfort: tonality wins. Pace, certainty, micro-pauses. Sound like the smartest person they'll talk to today.\n" +
          "Brunson: lead with a hook, deliver value before the ask, frame the offer as the obvious next step.\n" +
          "Carnegie: people don't care what you sell. They care about their problem, their building, their headache. Make them feel important.",
      },
      {
        id: "one-rule",
        title: "The One Rule",
        body:
          "Give immediate, specific value before you ask for anything. The email isn't a favor — it's a delivery channel for value they already want.",
      },
      {
        id: "why-works",
        title: "Why This Script Works",
        body:
          "1. **Pattern interrupt** — drone + AI + neighbor's property. Curiosity opener.\n" +
          "2. **Specific address** — proves it's not a list dial. Guard drops 50%.\n" +
          "3. **Problem named, not pitched** — moisture, deterioration, liability. They self-qualify.\n" +
          "4. **Open-ended cost question** — you learn their pain in dollars.\n" +
          "5. **Cut to the chase** — earns respect. Busy people love directness.\n" +
          "6. **Tangible deliverable** — \"damage assessment & savings report\" sounds like real work.\n" +
          "7. **Email ask is logistical, not commercial** — \"what's the email\" not \"can I email you.\"",
      },
      {
        id: "flirty-witty",
        title: "The Flirty/Witty Layer",
        body:
          "Your personality is leverage, not the strategy. Warmth, smile-in-voice, light teasing. Never use it to sell. Use it to make them want to keep talking.\n" +
          "• Smile before you dial. It's audible.\n" +
          "• Slow down. Confidence is paced. Nervous is fast.\n" +
          "• Tease, don't flirt. \"You're being suspicious of me — I respect that.\" Beats \"hi handsome.\"\n" +
          "• Be the relief in their day, not another thing to deal with. Tone = friend who happens to know about roofs.",
      },
    ],
  },
  {
    id: "masterScript",
    title: "Master Script",
    emoji: "📞",
    color: "green",
    sections: [
      {
        id: "step1-opener",
        title: "Step 1 — The Opener (Drone Hook)",
        body:
          "**Variant 1 — Tightest:**\n" +
          "\"Hey [Name], [Your Name] with Roof Kings. I was flying a drone next door to your building at [address] and pulled satellite on yours after — moisture flags, membrane's deteriorating. What are you spending a year on maintenance?\"\n\n" +
          "**Variant 2 — Conversational but fast:**\n" +
          "\"Hi [Name]? [Your Name], Roof Kings. Quick one — I was flying next door at [address], your roof showed up on satellite and it's not looking great. Moisture intrusion, deterioration. How much you spending on maintenance right now?\"\n\n" +
          "**Variant 3 — Most direct:**\n" +
          "\"[Name]? [Your Name] from Roof Kings. Pulled satellite on your roof at [address] — it's deteriorating. What's your annual maintenance run you?\"\n\n" +
          "**Variant 4 — Drone-first:**\n" +
          "\"Hey [Name], [Your Name] with Roof Kings. I was droning a building next to yours at [address] and your roof flagged for moisture. What are you spending a year keeping it patched?\"",
      },
      {
        id: "delivery-rules",
        title: "Delivery Rules (All Variants)",
        body:
          "• Pace: confident, calm, not rushed. Lower your pitch in the first 5 words.\n" +
          "• Don't trail off into \"...so yeah I was wondering...\" — land on the cost question hard.\n" +
          "• After the cost question, **SHUT UP**. Count to 4. They will fill silence.\n" +
          "• Cut every \"actually,\" \"just,\" \"I was hoping\" — they all soften the hook.",
      },
      {
        id: "step2-listen",
        title: "Step 2 — The Listen + Cut to the Chase",
        body:
          "No matter what they say, you agree, mirror it back, and pivot. Three response patterns:\n\n" +
          "**A. They give you a real number:**\n" +
          "THEM: \"We spent like 18k last year on patches.\"\n" +
          "YOU: \"Yeah, that tracks for a building that size — and that's the trap, right? You're paying every year and the roof's still aging. Let me cut to the chase. I put together a damage assessment and 20-year savings report on your building — what's the best email to send it to?\"\n\n" +
          "**B. They deflect or are vague:**\n" +
          "THEM: \"I don't really know, my guy handles it.\"\n" +
          "YOU: \"Totally — most owners don't track it line item, it just bleeds out. Let me cut to the chase. I already pulled together a damage assessment and savings report on your roof — what's the best email so I can shoot it over and your guy can take a look?\"\n\n" +
          "**C. They're cold or short:**\n" +
          "THEM: \"Not interested.\"\n" +
          "YOU: \"I figured — nobody wants to think about their roof. I'll cut to the chase, I'm not asking to come out, I'm not selling anything on this call. I already built a free assessment with the savings numbers on your specific building. What's the best email — if it's useless you delete it, if it's not, you've got it on file.\"",
      },
      {
        id: "step3-howd-you-get",
        title: "Step 3 — Handle 'How Did You Get My Number?'",
        body:
          "THEM: \"How'd you get my number?\"\n" +
          "YOU: \"Honestly? I paid good money for it. I'm picky about who I call because I'm good at my job and I don't like wasting anyone's time — including mine. So if I'm calling you, it's because your building actually fits what we do.\"",
      },
      {
        id: "step4-email",
        title: "Step 4 — The Email Capture",
        body:
          "YOU: \"Perfect — what's the best email? I'll send it over in the next 10 minutes, and if anything in there raises an eyebrow you just reply and we'll talk. If not, no harm done.\"\n\n" +
          "**Always confirm spelling. Always restate it back.**\n\n" +
          "YOU: \"Just so I don't fat-finger it — that's J-as-in-John, R-O-D-R-I-G-U-E-Z at the company dot com? Got it. Sending now.\"",
      },
      {
        id: "step5-followup",
        title: "Step 5 — The Set-Up for Future Follow-Up",
        body:
          "YOU: \"One last thing — once you've had a chance to look it over, I'll have someone follow up with you in a few days. If you want to skip the report and just talk now, I'm happy to walk you through how this thing works in 90 seconds. Otherwise I'll let you go.\"\n\n" +
          "This is the fork. Most will take the email and go. The 10-15% who say \"actually tell me more\" — that's where the product talk track kicks in.",
      },
    ],
  },
  {
    id: "rebuttals",
    title: "Rebuttal Library",
    emoji: "🛡️",
    color: "red",
    sections: [
      {
        id: "pattern",
        title: "Pattern: Agree → Reframe → Redirect to Email",
        body:
          "Memorize these. The pattern is always: **agree → reframe → redirect to the email.**",
      },
      {
        id: "just-had-it-done",
        title: "\"We just had it done.\"",
        body:
          "YOU: \"Oh perfect — then this'll either confirm you got a great job or save you from wasting the warranty. Our report compares your install to manufacturer spec. What's the email?\"",
      },
      {
        id: "going-to-replace",
        title: "\"We're going to replace it.\"",
        body:
          "YOU: \"Smart move if it's beyond restoration. Most owners don't realize SPF restoration is 40-60% cheaper than tear-off and gives you the same 20-year warranty. The report shows both numbers side by side — worst case it confirms replacement is right. Email?\"",
      },
      {
        id: "my-roofer-handles",
        title: "\"My roofer handles all that.\"",
        body:
          "YOU: \"Love that — most of our biggest clients have a guy. We're usually who their guy calls when it's beyond patch work. Send it to your guy too, or I can copy him. What's the best email?\"",
      },
      {
        id: "send-info",
        title: "\"Send it to info@…\"",
        body:
          "YOU: \"I will, but info@ is where good intel goes to die. Give me your direct so I know it's actually in front of the decision maker. I'll cc info@ too if that's easier.\"",
      },
      {
        id: "how-much",
        title: "\"How much does it cost?\"",
        body:
          "YOU: \"Depends on square footage, condition, and whether you want the 15 or 20 year warranty — usually $4-7 a foot installed, but the ROI report shows your specific number against energy savings and tax write-offs under 179D. Want me to send it?\"",
      },
      {
        id: "not-decision-maker",
        title: "\"I'm not the decision maker.\"",
        body:
          "YOU: \"No problem — who is, and what's the best way to get it in front of them? Or I can send it to you and you forward — whichever's easier.\"",
      },
      {
        id: "under-contract",
        title: "\"We're under contract with another roofer.\"",
        body:
          "YOU: \"Got it — most contracts are for service, not capital improvements. The restoration is a one-time thing and your roofer can usually maintain it after. Worth seeing the numbers either way.\"",
      },
      {
        id: "do-not-call",
        title: "\"Just put me on your do not call list.\"",
        body:
          "YOU: \"Absolutely, will do right now. Before I let you go — you want me to email the report so you have it on file? No follow up, just so you've got the data on your building.\"\n(If yes — capture. If no — thank, log, move on.)",
      },
      {
        id: "whats-this-about",
        title: "\"What's this really about?\"",
        body:
          "YOU: \"Fair question. I'm not going to pretend — we restore commercial roofs with spray foam and silicone. That's the long-term play. Today though, all I want is to send you a free report on your building. If it's valuable, we'll talk. If not, you've got free intel.\"",
      },
      {
        id: "no-time",
        title: "\"I don't have time.\"",
        body:
          "YOU: \"I hear that all day — 30 seconds. What's the best email, I'll send a 1-page report you can read on the toilet later. Done.\"",
      },
      {
        id: "building-fine",
        title: "\"My building's fine.\"",
        body:
          "YOU: \"Hope so — but the AI flagged a few things from satellite I want you to see, even just so you know what to watch for. What's the email?\"",
      },
      {
        id: "three-strike",
        title: "The 3-Strike Rule",
        body:
          "Three rebuttals max. After three nos, exit gracefully — \"Totally hear you, I'll get out of your hair. Have a good one.\" Burned bridges don't refer.",
      },
    ],
  },
  {
    id: "productTalk",
    title: "Product Knowledge",
    emoji: "🏗️",
    color: "purple",
    sections: [
      {
        id: "ninety-second",
        title: "The 90-Second Version",
        body:
          "\"So we're Roof Kings — 30 years in business, based in South Florida, 5 fully equipped trucks, crew that's been with us 20 years. We've sprayed millions of square feet across the country. What we do is we take your existing commercial roof — whether it's modified bit, BUR, EPDM, TPO — and we spray a layer of closed-cell polyurethane foam right over it. That foam fills every crack, every penetration, every low spot, and gives you R-7 insulation per inch. Then we prime it and top-coat it with high-solids silicone. The result is one seamless, monolithic, watertight membrane — no seams, no penetrations, fully UV-reflective, fully wind-rated. Carries a 15 or 20-year manufacturer warranty. Energy savings alone pay for it in 4-6 years, and the entire job qualifies for 179 and 179D tax write-off.\"",
      },
      {
        id: "components",
        title: "Component Breakdown",
        body:
          "**Spray Polyurethane Foam (SPF):** Closed-cell, 2.8-3.0 lb density. Sprayed at 1-1.5 inches typical. Self-flashing, self-adhering, self-insulating. R-value of 6.5-7 per inch — best insulation on the market.\n\n" +
          "**Primer:** Bonds the silicone to the foam. Critical layer most cheap installers skip. We don't.\n\n" +
          "**Silicone Top Coat:** High-solids silicone, 2.5-3 gallons per square. UV-stable, ponding-water resistant, never gets brittle, easy to recoat at year 20.\n\n" +
          "**Granules (optional):** Embedded in wet silicone for foot traffic and hail resistance.\n\n" +
          "**Warranty:** 15 or 20-year manufacturer NDL (no dollar limit). Recoatable indefinitely.",
      },
      {
        id: "why-wins",
        title: "Why-It-Wins Hits",
        body:
          "• **No tear-off** — saves 40-60% vs replacement, no business interruption, no dumpsters.\n" +
          "• **Seamless** — water has nothing to penetrate. Every TPO/EPDM seam is a future leak.\n" +
          "• **Self-flashing** — penetrations, curbs, drains all get encapsulated.\n" +
          "• **Wind-rated** — Florida-tested, hurricane-rated assemblies available.\n" +
          "• **UV reflective** — 85%+ reflectivity. Building runs cooler. HVAC works less.\n" +
          "• **179 / 179D tax treatment** — full write-off for energy-efficient improvements.\n" +
          "• **Recoatable** — at year 20, wash and recoat. New 15-year warranty for ~25% of original cost.",
      },
      {
        id: "complaints",
        title: "Common Owner Complaints",
        body:
          "• \"I keep paying for patches and it keeps leaking.\" → SPF eliminates seams. Patches address symptoms, not the cause.\n" +
          "• \"My roofer wants $400k for replacement.\" → SPF restoration is typically 40-60% less.\n" +
          "• \"I can't shut down for two weeks for tear-off.\" → SPF is applied during business hours, no disruption.\n" +
          "• \"My energy bills are insane.\" → R-7/inch + 85% UV reflectivity. Reduces cooling load 20-30%.\n" +
          "• \"My insurance keeps raising rates.\" → Restored roofs with manufacturer warranty often qualify for premium reductions.\n" +
          "• \"I'm thinking of selling the building.\" → Restored roof = warranty transfer = stronger comp.",
      },
      {
        id: "insurance",
        title: "Insurance + Liability Angle",
        body:
          "• Old roof + known leak history = exclusion or massive premium hike at renewal.\n" +
          "• A failed roof = interior damage, mold remediation, business interruption claims.\n" +
          "• Restored roof with NDL warranty = a defensible asset on their loss runs.\n" +
          "• If they have a tenant who slips, sues, or claims mold — old leaky roof is exhibit A.",
      },
      {
        id: "tax",
        title: "Tax Angle — Section 179 vs 179D",
        body:
          "• **Section 179:** lets businesses fully expense qualifying capital improvements in year 1 (up to the annual cap, currently >$1M). Roof restoration qualifies.\n" +
          "• **Section 179D:** energy-efficient commercial buildings deduction. Up to $5+/SF for qualifying upgrades. Cool roof + insulation qualifies.\n" +
          "• **Translation for the call:** \"Instead of paying taxes on that money, you fix the most expensive part of your building. The IRS basically pays for it.\"\n" +
          "• Always say \"talk to your CPA to confirm your specific eligibility.\"",
      },
    ],
  },
  {
    id: "roofTypes",
    title: "Roof Type Guide",
    emoji: "🏠",
    color: "cyan",
    sections: [
      {
        id: "modbit",
        title: "Modified Bitumen (Mod Bit)",
        body:
          "Asphalt-based rolled roof. Common on older buildings. **Tells:** torch-applied, granulated surface, seams every 3 feet. **Failures:** alligatoring, blistering, seam separation.",
      },
      {
        id: "bur",
        title: "Built-Up Roof (BUR)",
        body:
          "Old-school tar and gravel. Multi-ply asphalt with gravel on top. **Tells:** gravel surface, heavy. **Failures:** ponding water, alligatoring, gravel migration.",
      },
      {
        id: "epdm",
        title: "EPDM (Rubber)",
        body:
          "Black single-ply rubber. Most common on warehouses 1990s-2010s. **Tells:** black, large sheets, tape seams. **Failures:** shrinkage, seam failure, punctures.",
      },
      {
        id: "tpo",
        title: "TPO",
        body:
          "White single-ply, heat-welded seams. Most common on new construction last 15 years. **Tells:** white, weld lines. **Failures:** seam splits, premature aging, hail.",
      },
      {
        id: "pvc",
        title: "PVC",
        body:
          "Similar to TPO, heat-welded, more chemical resistant. Common on restaurants. **Tells:** white or gray, often with vent stains.",
      },
      {
        id: "metal",
        title: "Metal (R-Panel / Standing Seam)",
        body:
          "Steel or aluminum panels. **Tells:** ribs, screws, panel laps. **Failures:** rust, fastener back-out, oil-canning. SPF is excellent over metal.",
      },
      {
        id: "spf-existing",
        title: "SPF (Existing)",
        body:
          "Already spray foam. **Tells:** monolithic, no seams, often chalky. Just needs recoat usually — easy sale.",
      },
      {
        id: "damage-signs",
        title: "Common Damage Signs",
        body:
          "• **Ponding water** — standing water 48+ hours after rain.\n" +
          "• **Alligatoring** — cracking pattern that looks like reptile skin. UV degradation.\n" +
          "• **Blistering** — bubbles in the membrane from trapped moisture/vapor.\n" +
          "• **Seam separation** — TPO/EPDM seams pulling apart. #1 leak source.\n" +
          "• **Membrane shrinkage** — EPDM pulling away from edges and penetrations.\n" +
          "• **Granule loss** — mod bit losing its protective top layer.\n" +
          "• **Penetration failures** — pitch pans, vents, HVAC curbs. Most common leak point.\n" +
          "• **Saturated insulation** — wet insulation under the membrane. Invisible from above.",
      },
      {
        id: "property-types",
        title: "Property Types You'll Call",
        body:
          "• **Warehouses / Industrial:** huge SF, low-slope, owner is usually a holding LLC. Hot button: energy savings.\n" +
          "• **Strip Centers / Retail:** multi-tenant. Hot button: \"Don't tear off — we can't shut down tenants.\"\n" +
          "• **Office Buildings:** class B/C. Hot button: energy savings + 179D tax.\n" +
          "• **Hotels / Motels:** guest disruption is the killer. SPF = no tear-off = no disruption.\n" +
          "• **Self-Storage:** metal roofs everywhere. SPF over metal = perfect application.\n" +
          "• **Manufacturing / Food Production:** leak = product loss = catastrophic. Sell on risk reduction.\n" +
          "• **Medical / Cold Storage:** high R-value matters. SPF is the king of insulation.",
      },
    ],
  },
  {
    id: "icebreakers",
    title: "Icebreaker Variations",
    emoji: "🎯",
    color: "amber",
    sections: [
      {
        id: "drone",
        title: "The Drone (default)",
        body:
          "\"Hey is this [Name]? Hi — [Your Name] with Roof Kings. I'm flying a drone over your neighbor's building at [address] right now and our AI flagged your roof in the background. Pulled satellite — looks like moisture intrusion and the membrane's deteriorating. Quick question, what are you spending a year on maintenance?\"",
      },
      {
        id: "tax-hook",
        title: "The Tax Hook",
        body:
          "\"Hey [Name] — [Your Name] from Roof Kings. I'm calling because your building at [address] qualifies for a 179D tax deduction most owners don't know about, and your roof's the trigger. You got 60 seconds?\"",
      },
      {
        id: "neighbor",
        title: "The Neighbor",
        body:
          "\"Hi [Name], [Your Name] with Roof Kings. I just finished a building two doors down from yours at [nearby address] and your roof was in every drone shot. Couldn't help noticing — it's starting to age. What's your maintenance budget on it right now?\"",
      },
      {
        id: "insurance-angle",
        title: "The Insurance Angle",
        body:
          "\"Hey [Name] — [Your Name] at Roof Kings. Quick one: when's your property insurance up for renewal? Reason I'm asking — your roof at [address] is showing signs that flag with carriers, and there's a way to get ahead of it. Got 60 seconds?\"",
      },
      {
        id: "direct",
        title: "The Direct (no warmup)",
        body:
          "\"Hey [Name], it's [Your Name] from Roof Kings. I'm not going to waste your time — I built a free assessment on your building at [address], it shows the roof condition, replacement cost, restoration cost, and 20-year savings. What's the best email to send it to?\"",
      },
      {
        id: "curious",
        title: "The Curious",
        body:
          "\"Hi [Name], [Your Name] at Roof Kings. Random question — when was the last time anyone actually walked your roof at [address]? (pause for answer) That's what I figured. Let me cut to the chase…\"",
      },
      {
        id: "confession",
        title: "The Confession",
        body:
          "\"Hey [Name], I'm going to be honest — this is a cold call. But I promise it's a useful one. [Your Name] with Roof Kings, I've got a free report on your building at [address] that I think will save you money. Worth 30 seconds?\"",
      },
      {
        id: "energy-bill",
        title: "The Energy Bill",
        body:
          "\"Hi [Name], [Your Name] with Roof Kings. Quick question: are your summer energy bills at [address] hurting? (yes/maybe) Your roof's doing about 60% of that. I built a report on what we can do about it — what's the email?\"",
      },
      {
        id: "storm",
        title: "The Storm",
        body:
          "\"Hey [Name] — [Your Name] at Roof Kings. After the [recent storm/hurricane/big rain event], we ran satellite on commercial roofs in your zip and yours is flagged for moisture. Want me to send the assessment?\"",
      },
      {
        id: "witty",
        title: "The Witty",
        body:
          "\"Hi is this [Name]? Hey it's [Your Name], I promise I'm not selling timeshares. I'm with Roof Kings and I've got something genuinely useful for you — I built a free report on your building at [address]. Got 30 seconds or am I catching you mid-something?\"",
      },
    ],
  },
  {
    id: "scenarios",
    title: "Scenario Playbook",
    emoji: "🎭",
    color: "indigo",
    sections: [
      {
        id: "gatekeeper",
        title: "Gatekeeper / Assistant Picks Up",
        body:
          "THEM: \"[Owner]'s office, this is Sarah.\"\n" +
          "YOU: \"Hi Sarah! It's [Your Name] over at Roof Kings — is [Owner] around? I'm the one with the report on the building at [address]. He's expecting it.\"\n" +
          "(\"He's expecting it\" works because — technically — every commercial owner is expecting roof issues eventually. Don't lie. Don't claim a referral. The frame is enough.)",
      },
      {
        id: "voicemail",
        title: "Voicemail",
        body:
          "YOU: \"Hey [Name], it's [Your Name] from Roof Kings. I built a free assessment on your building at [address] — moisture flags from satellite, 20-year cost comparison, the works. I'll text you the email link too. No pressure, just useful. [Phone number] — [Your Name], Roof Kings, talk soon.\"\n" +
          "(Keep it under 20 seconds. Mention the address. Mention the deliverable.)",
      },
      {
        id: "annoyed",
        title: "They Pick Up Annoyed",
        body:
          "THEM: \"What.\"\n" +
          "YOU: \"(small laugh) Got it, you're in the middle of something. [Your Name] at Roof Kings — 30 seconds and you tell me to go away or send me your email. Fair?\"",
      },
      {
        id: "chatty",
        title: "They're Friendly + Chatty",
        body:
          "Don't overstay. Get the email and exit. Friendly people forget to read your email if you spent 20 minutes on the phone.\n" +
          "YOU: \"Loved chatting with you — let me get this report over before I forget. What's the best email?\"",
      },
      {
        id: "pm",
        title: "Decision Maker Says 'Send to my Property Manager'",
        body:
          "YOU: \"Will do — what's their email and name? And I'll cc you so you've got it on file. PMs usually want owner approval anyway, easier if you've already seen it.\"",
      },
      {
        id: "references",
        title: "They Ask for References",
        body:
          "YOU: \"Absolutely — I'll include a reference list in the report. We work with Levy Realty, HHH, Khan Management, Weaver — and I'll drop in a couple of project case studies that match your building type. What's the email?\"",
      },
      {
        id: "come-out-today",
        title: "They Ask If You Can Come Out Today",
        body:
          "YOU: \"Love that energy. Let me send the report first so you've got context, and I'll have someone with the equipment out within 48 hours to core test and confirm. What's the email — and is the building accessible during business hours?\"",
      },
      {
        id: "out-of-state",
        title: "Out-of-State Owner",
        body:
          "YOU: \"Got it, you're remote — even better, the report's all you need to make the call. Who's your local property manager and what's their email? I'll send to both.\"",
      },
      {
        id: "bank-owned",
        title: "Bank-Owned / REO / 'Owner's a Bank'",
        body:
          "YOU: \"Perfect, banks LOVE this — restoration vs replacement is a 40% cost saving and 179D is a hard write-off. Who's the asset manager? Even just an email and I'll do the rest.\"",
      },
      {
        id: "already-customer",
        title: "Already a Roof Kings Customer",
        body:
          "YOU: \"Oh I am SO sorry — let me get that flagged so we don't call you again. Quick — who's your rep here, just so I can give them a heads up? And while I have you, are you happy with the install?\"\n" +
          "(Always turn this into a referral ask.)",
      },
    ],
  },
  {
    id: "tonality",
    title: "Tonality & Pacing",
    emoji: "🎙️",
    color: "pink",
    sections: [
      {
        id: "seven-tonalities",
        title: "The 7 Tonalities (Belfort)",
        body:
          "1. **I care / I really want to know** — the question voice. Curious, leaning in.\n" +
          "2. **I feel your pain** — empathetic. Slower. Lower.\n" +
          "3. **Money on the table** — urgency without panic. Brisk.\n" +
          "4. **Reasonable man / Implied obviousness** — \"obviously you'd want to see this.\"\n" +
          "5. **Mystery / Intrigue** — drop volume, slow down. \"There's something I want you to see.\"\n" +
          "6. **Scarcity** — \"I can't do this for everyone, that's why I'm calling you.\"\n" +
          "7. **Absolute certainty** — slow, clipped, no ums, no qualifiers. The expert voice.",
      },
      {
        id: "pacing",
        title: "Pacing Rules",
        body:
          "• First 8 seconds: SLOWER than feels natural. Lower pitch. Calm.\n" +
          "• Question delivery: rising tone at the end. Real question, not a statement.\n" +
          "• After the cost question: SHUT UP. Count to 4 in your head.\n" +
          "• After they answer: 1-second pause before you respond.\n" +
          "• During the email ask: brisk, casual, like asking for a phone number for a delivery.",
      },
      {
        id: "words-cut",
        title: "Words to Cut",
        body:
          "• \"Just\" (makes you sound small)\n" +
          "• \"Sorry to bother\" (positions you as a bother)\n" +
          "• \"I was wondering\" (uncertainty)\n" +
          "• \"Maybe\" / \"perhaps\" / \"kinda\" (weakens everything)\n" +
          "• \"Hopefully\" (sounds like a prayer)",
      },
      {
        id: "words-win",
        title: "Words That Win",
        body:
          "• **\"Specifically\"** — \"I'm calling specifically about your building at…\"\n" +
          "• **\"Honestly\"** — flips a switch. People lean in.\n" +
          "• **\"I'll cut to the chase\"** — magic words for busy people.\n" +
          "• **\"Worth seeing\"** — low-pressure value frame.\n" +
          "• **\"Real quick\"** — bookends a 10-second ask.",
      },
    ],
  },
  {
    id: "quickRef",
    title: "Quick Reference Card",
    emoji: "📋",
    color: "green",
    sections: [
      {
        id: "four-steps",
        title: "The 4 Steps",
        body:
          "1. Drone hook + maintenance question.\n" +
          "2. Listen → agree → \"cut to the chase.\"\n" +
          "3. Damage assessment & savings report → \"what's the email?\"\n" +
          "4. Confirm spelling → set up follow-up → exit.",
      },
      {
        id: "got-the-number",
        title: "If They Ask How You Got the Number",
        body:
          "\"I paid good money for it. I'm picky because I'm good at my job and I don't waste time.\"",
      },
      {
        id: "pushback",
        title: "If They Push Back",
        body:
          "Agree → reframe → redirect to email. **3 strikes max.** Then exit clean.",
      },
      {
        id: "product-oneliner",
        title: "Product 1-Liner",
        body:
          "\"Spray foam over your existing roof, sealed with silicone. Seamless, watertight, UV-reflective, 20-year warranty, pays for itself in 4-6 years on energy alone, fully tax-deductible under 179D.\"",
      },
      {
        id: "names",
        title: "Names to Drop (sparingly)",
        body: "Levy Realty. HHH. Khan. Weaver.",
      },
      {
        id: "daily-numbers",
        title: "Daily Numbers",
        body: "100 dials → 15-20 connects → 10-12 conversations → 3-4 emails → 1-2 hot.",
      },
      {
        id: "vm",
        title: "Voicemail (under 20 seconds)",
        body:
          "\"[Name], [Your Name] at Roof Kings — built a free assessment on your building at [address]. Moisture flags, 20-year cost comparison. I'll text the email link too. No pressure, just useful. [Number]. Talk soon.\"",
      },
      {
        id: "mantras",
        title: "Mantras",
        body:
          "• Smile before you dial.\n" +
          "• Slow down.\n" +
          "• The email is the only goal.\n" +
          "• Three strikes, then exit clean.\n" +
          "• Be the relief in their day.",
      },
    ],
  },
  {
    id: "training",
    title: "New Rep Training",
    emoji: "📚",
    color: "yellow",
    sections: [
      {
        id: "day1",
        title: "Day 1 — Absorption",
        body:
          "• Read this entire playbook out loud. Twice.\n" +
          "• Watch 3 hours of Belfort straight-line content (YouTube).\n" +
          "• Watch 1 hour of Brunson hook framework (YouTube).\n" +
          "• Read \"How to Win Friends and Influence People\" (or the 1-hour summary).\n" +
          "• Memorize the Master Script verbatim. Test on yourself in the mirror.",
      },
      {
        id: "day2",
        title: "Day 2 — Product Knowledge",
        body:
          "• Memorize the 90-second product talk track.\n" +
          "• Quiz on roof types — name 4 from sight, name failure modes for each.\n" +
          "• Quiz on rebuttals — partner reads objection, rep responds in under 3 seconds.\n" +
          "• Walk a real Roof Kings job site. Look at the materials. Touch the foam. Smell the silicone.",
      },
      {
        id: "day3",
        title: "Day 3 — Role Play",
        body:
          "• Manager plays prospect. 25 calls. Every variant. Every objection.\n" +
          "• Record every role play. Listen back. Note: pace, fillers, weak words.\n" +
          "• Don't move to live calls until role play is automatic.",
      },
      {
        id: "day4",
        title: "Day 4 — Live Calls (Shadowed)",
        body:
          "• Manager listens to 20 live calls. Notes only — no interruption.\n" +
          "• After every 5 calls: 10-minute debrief. What worked, what to adjust.\n" +
          "• Goal: 1-2 emails captured by end of day.",
      },
      {
        id: "day5",
        title: "Day 5 — Solo + Review",
        body:
          "• Rep dials 50+ alone.\n" +
          "• End of day: review 5 random calls together.\n" +
          "• Goal: 5+ emails captured, 1+ live conversation moved to product talk track.",
      },
      {
        id: "ongoing",
        title: "Ongoing Standards",
        body:
          "• **Daily:** 100+ dials, 10+ conversations, 3+ emails captured.\n" +
          "• **Weekly:** review 3 random calls per rep with the team. Public learning, not punishment.\n" +
          "• **Monthly:** update the rebuttal library with new objections that worked.",
      },
      {
        id: "scorecard",
        title: "Scorecard (Per Call)",
        body:
          "• Dials per hour: 25-30\n" +
          "• Connect rate: 15-20% (pickup)\n" +
          "• Conversation rate: 60% of connects\n" +
          "• Email capture rate: 30%+ of conversations\n" +
          "• Hot conversation (product talk): 10-15% of conversations\n" +
          "• Booked assessment: 3-5% of conversations",
      },
    ],
  },
];

export function getCategory(id: string): PlaybookCategory | undefined {
  return PLAYBOOK.find((c) => c.id === id);
}

// Tiny inline-markdown renderer: **bold**, *em*, and preserves \n.
// Returns a React node tree. Used by Training Center + floating panel.
export function renderInline(text: string): React.ReactNode[] {
  // Split on **bold** first, then *em*. Keep escape simple (no nested).
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push(text.slice(last, idx));
    const tok = m[0];
    if (tok.startsWith("**")) {
      out.push(<strong key={key++}>{tok.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    last = idx + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// React import lives here for renderInline (kept at file end so the data above
// is plain TS without React noise).
import * as React from "react";

/* =============================================================
   Backwards-compat shims for the old API used by other modules
   (CallPlaybookPanel, PlaybookContent, training route).
   These mirror the legacy schema by flattening categories so any
   call site that hasn't been migrated keeps working without crashes.
   ============================================================= */

export type PlaybookBlock =
  | { kind: "script"; label: string; lines: string[] }
  | { kind: "qa"; question: string; answer: string }
  | { kind: "list"; label: string; items: string[] }
  | { kind: "callout"; label: string; body: string };

export interface LegacyPlaybookSection {
  id: string;
  title: string;
  short: string;
  blocks: PlaybookBlock[];
}

export const PLAYBOOK_SECTIONS: LegacyPlaybookSection[] = PLAYBOOK.map((cat) => ({
  id: cat.id,
  title: cat.title,
  short: cat.sections[0]?.title ?? "",
  blocks: cat.sections.map((s) => ({
    kind: "callout" as const,
    label: s.title,
    body: s.body,
  })),
}));

export function fillPlaceholders(
  s: string,
  ctx: Record<string, string | number | null | undefined>,
): string {
  return s.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, k) => {
    const v = ctx[k];
    return v === undefined || v === null || v === "" ? `[${k}]` : String(v);
  });
}
