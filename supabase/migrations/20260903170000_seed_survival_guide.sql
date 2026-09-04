-- The Blue Collar Sales Survival Guide, as course content.
--
-- The guide has lived as a single 182KB static HTML file behind an iframe since
-- it was written: 15 sections, 125 cards, 118 word-for-word scripts, 18,688
-- words. Readable, but not teachable -- nothing could track who had read what,
-- quiz anyone on it, or answer a question about it.
--
-- This lifts it into rows with its own structure intact: each section becomes a
-- module, each card a lesson, and the scripts stay in their own column so a
-- talk track is never mixed up with the explanation around it.
--
-- Keyed to companies, not cb_workspaces. Marked 'network' visibility: every
-- company on the app can read it, which is what makes it the seed of the
-- shared classroom rather than one company's private folder.
insert into public.training_courses (id, company_id, title, slug, subtitle, source, visibility, status, estimated_minutes)
values ('11111111-2222-4333-8444-555555555501', 'dfd60203-5a0c-4d07-a437-205c651386e0',
 'Blue Collar Sales Survival Guide',
 'blue-collar-sales-survival-guide',
 'Scripts, rebuttals, insurance talk tracks and closes for storm damage reps in the field.',
 'survival-guide/index.html', 'network', 'published', 240)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600000','11111111-2222-4333-8444-555555555501','🧠 The Philosophy','The mindset before the script. If your head isn''t right, no rebuttal saves you.','sec-philosophy',0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555700000','11111111-2222-4333-8444-555555600000','11111111-2222-4333-8444-555555555501','The Blue Collar Operator''s Code','You''re not a "sales guy." You''re a problem solver who happens to carry a clipboard, a phone, or a pair of boots. The homeowner doesn''t want a roof — they want their house to stop being a source of stress. The property manager doesn''t want bids — they want one less fire to put out this week. Sell the relief, not the shingles.
•
Show up like a professional, talk like a neighbor.
Polo + clipboard + truck wrap beats suit + tie every time at the door. On the phone, sound like the smartest friend they have in the trades — not a script reader.
•
You''re not interrupting them — you''re correcting their ignorance.
Most people don''t know their roof is failing until water is in the drywall. You''re the early warning system.
•
The deal is decided in the first 15 seconds.
Tone, pace, smile, certainty. The words matter less than people think. (Belfort: tonality 70%, body language 20%, words 10%.)
•
Stay in the conversation longer than they expect.
Average rep eats a "not interested" and leaves. Top reps reframe and stay one more beat. 80% of money is on the other side of that beat.
•
You''re a transaction broker, not a friend-maker.
Friendliness is the wrapper, not the goal. Don''t trade the close for likeability.','[]'::jsonb,'[]'::jsonb,221,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555700001','11111111-2222-4333-8444-555555600000','11111111-2222-4333-8444-555555555501','Three Voices to Channel','Belfort:
tonality wins. Pace, certainty, micro-pauses. Sound like the smartest person they''ll talk to today.
Brunson:
lead with a hook, deliver value before the ask, frame the offer as the obvious next step.
Carnegie:
people don''t care what you sell. They care about their problem, their building, their headache. Make them feel important.
Add J. Douglas Edwards on top of all three:
assume the sale. Use the close that fits the moment. Never ask a question you don''t already know the answer to.','[]'::jsonb,'[]'::jsonb,83,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555700002','11111111-2222-4333-8444-555555600000','11111111-2222-4333-8444-555555555501','The One Rule','Give immediate, specific value before you ask for anything. The knock, the call, the DM — none of those are favors you''re asking for. They''re
delivery channels for value the customer already wants
. Your job is to make that delivery so obviously useful they can''t say no without feeling foolish.
If the first thing out of your mouth is an ask, you''ve already lost. If the first thing out of your mouth is a
specific observation about them
, you''re in.','[]'::jsonb,'[]'::jsonb,82,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555700003','11111111-2222-4333-8444-555555600000','11111111-2222-4333-8444-555555555501','Why Most Reps Fail in Year One','•
They take "no" as information instead of as a reflex.
80% of first "no"s are pre-trained gatekeepers. Not real objections.
•
They pitch too early.
No problem found, no urgency built, no money confirmed — but already talking square footage. People buy out of pain. Find the pain first.
•
They confuse activity with productivity.
200 dials of mush beats nothing, but 80 dials with recordings, scoring, and one daily coaching session crushes 200 dials.
•
They quit at the cliff.
The roofing/trades rep who survives month 4 prints money in year 2. The one who quits in week 7 never tells anyone how close they were.
•
They believe the customer.
When a homeowner says "we''ll think about it," they''re not thinking about it. They have an unresolved objection they didn''t tell you. Your job is to find it.','[]'::jsonb,'[]'::jsonb,141,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555700004','11111111-2222-4333-8444-555555600000','11111111-2222-4333-8444-555555555501','Daily Rituals That Print Money','•
5 min before first knock/dial:
Stand up, deep breath, smile, say your opener out loud three times. Audible smile is real.
•
End of every block:
Score yourself. How many contacts? How many problem-found? How many sit-downs? How many closes attempted? Track the funnel, not just the win.
•
End of day, 15 min review:
Listen to one call recording. Find one thing to fix tomorrow. One. Not five. One.
•
Friday afternoon:
Write three handwritten thank-you cards. To closed customers, to a referral source, or to a "not now" who treated you well. This is your Year 2 pipeline.
•
Sunday night:
Plan Monday before noon. Top 10 callbacks queued, top 5 streets mapped, top 3 referral asks. Monday morning is too late to plan Monday.','[]'::jsonb,'[]'::jsonb,128,4)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','🎓 Sales Trainer Cheat Sheets','The greatest hits of every trainer you should be stealing from. Lift their tactics, not their style.','sec-trainers',1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701000','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','J. Douglas Edwards — The Father of Modern Closing','Edwards built the language of modern closing in the 1950s-70s and trained Tom Hopkins, Zig Ziglar, and most of the trainers you''ve heard of since. If you only memorize one trainer cold, make it Edwards.
Edwards'' Core Beliefs
•
"A close is a question whose answer confirms the sale."
Stop asking yes/no questions. Ask choice questions.
•
"Whenever you ask a closing question, shut up. The next person to talk loses."
Silence is a weapon. Practice it.
•
"People are convinced by reasons they discover themselves."
Don''t tell them why they need a new roof. Ask the question that makes them say it.
Edwards'' Most-Used Closes
•
Alternate of Choice
— never ask "do you want it," ask "do you want A or B." "Would Tuesday or Thursday work better for the install?"
•
Sharp Angle
— when they raise an objection that''s actually a request, throw it back. "If I could get you the 50-year shingle at the 30-year price, would you be ready to move forward today?"
•
Order Blank
— start filling out the paperwork while you talk. Their non-objection IS the close.
•
Puppy Dog
— "Let me leave the sample shingle with you for the weekend. If it doesn''t fit, I''ll come pick it up Monday." Hard to give the puppy back.
•
Ben Franklin (T-account)
— when stuck on a fence-sitter, draw a line down the page. Help them list reasons to do it. Then say "now you list the reasons not to" and stay silent. They always come up short on the right.
•
Lost Sale
— when the deal walks, before you leave, say
"Mrs. Jones, I''m clearly not going to earn your business today, and that''s okay. But for my own training, what could I have done differently?"
30% of the time, the real objection comes out — and you get to handle it.
•
Similar Situation
— third-person story. "Mr. and Mrs. Garcia on Elm thought the same thing six months ago. Here''s what they decided…"
•
Erroneous Conclusion
— purposefully say a wrong "fact" so they correct you, and the correction confirms the sale. "So you said you wanted to wait until
next
spring, right?" "No, I said this fall." → Calendar''s out.
"The sale is made in the silence after the close, not in the words before it."
— J. Douglas Edwards','[]'::jsonb,'[]'::jsonb,394,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701001','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Jordan Belfort — The Straight Line','Belfort''s contribution is tonality and the Straight Line System — keep the prospect on a tight conversational line from open to close, looping back through three tens.
The Three Tens
By the close, your prospect must be a 10/10 certain on three things: (1) the
product
, (2)
you
, (3)
your company
. If any of those is below a 9, you''re not closing — you''re "looping" to raise that score.
Belfort''s Tonality Stack (memorize these)
•
"I care, I really want to know"
— questioning tone, slight upward inflection
•
The mysterious mystique tone
— drops in volume, slows down, draws them in
•
The "money tone"
— when you say the price, drop the voice, slow down, no apology
•
Scarcity / urgency tone
— hushed, like sharing a secret
•
Absolute certainty
— flat, level, no waiver. Not loud.
Certain.
The Looping Pattern
Prospect objection → "I hear you, and let me ask you this…" → loop them into a question that raises certainty on the weakest "ten" → re-close. Never argue. Never defend. Loop.','[]'::jsonb,'[]'::jsonb,179,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701002','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Tom Hopkins — Assume, Assume, Assume','Hopkins trained under Edwards and refined the assumptive close into something blue collar reps can use immediately.
•
Assumptive language at every turn.
Never "if we do this" — always "when we do this." Never "should you decide" — always "once we get this scheduled."
•
The 1-2-3 Close.
"There are three good reasons to move forward today: one, the price holds; two, we can fit your install before the rainy season; three, your neighbors are getting their work done now and the crew is in your zip code. Sound fair?"
•
The Tie-Down.
End statements with a built-in agreement: "…makes sense, doesn''t it?" / "…that''s important to you, isn''t it?" / "…you''d want that, wouldn''t you?" Use sparingly — 3 max per conversation.
•
"Don''t say ''cost.'' Say ''investment.'' Don''t say ''contract.'' Say ''agreement.'' Don''t say ''sign.'' Say ''okay it'' or ''authorize.''"
Reframe the loaded words.','[]'::jsonb,'[]'::jsonb,147,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701003','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Zig Ziglar — Emotion Buys, Logic Justifies','Ziglar''s gift: he understood that the buying decision is emotional and the rep''s job is to give the emotional brain enough logical cover to feel okay about it.
•
"People don''t buy for logical reasons. They buy for emotional reasons. Then they justify with logic."
— say the emotional thing first (their family safe and dry; their property value protected; pride of ownership), back it with logic second (warranty, square footage, financing math).
•
"You can have everything in life you want, if you will just help enough other people get what they want."
Reframe yourself as the help, not the seller.
•
The pain-pleasure pivot.
Spend 60% of the conversation on the pain of
not
doing it (water damage, mold, insurance non-renewal, decking rot) and 40% on the pleasure of doing it (peace of mind, curb appeal, warranty backing).','[]'::jsonb,'[]'::jsonb,140,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701004','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Russell Brunson — Hook, Story, Offer','Brunson is a marketer first, but his Hook/Story/Offer structure is the cleanest framework for a 60-second pitch — at the door, on the phone, in a DM.
The Three Beats
•
Hook
— the pattern interrupt. Specific, weird, or curiosity-piquing. Earn the next 10 seconds.
•
Story
— third-party proof. A similar customer, a recent storm, a discovery on a neighbor''s roof. People believe stories before facts.
•
Offer
— the very next step. Not the sale. The micro-yes: a free inspection, a 10-minute report, a sample.
Door example:
"Hi — quick one. We were doing drone scans on Maple yesterday [hook] and we spotted three or four homes on this block with hail bruising that''s eligible for an insurance look [story]. I''d like to drone-scan yours real quick — 8 minutes, free, you keep the photos [offer]."','[]'::jsonb,'[]'::jsonb,138,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701005','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Dale Carnegie — Make Them Feel Important','•
Use their name. Twice.
Once at the open, once at the close. More than that gets weird.
•
Talk in terms of
their
interests.
"Your house," "your driveway," "your kids," "your warranty," "your tenant." Almost never "we" or "our company."
•
Be a good listener. Encourage them to talk about themselves.
The longer they talk, the closer you are. Aim for them talking 60% of the time after the opener.
•
Begin in a friendly way.
No matter how rough the open looks — smile, soft tone, slow pace.
•
Let the other person feel the idea is theirs.
"You mentioned earlier you were worried about the granule loss — that''s exactly what we want to put a number on today."','[]'::jsonb,'[]'::jsonb,122,5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701006','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Grant Cardone — 10X & The Hard Close','•
Massive action, then massive action again.
The actual prescription: 10x whatever you think the right activity number is. If you think 30 dials, do 300. If you think 5 doors, do 50.
•
"The deal is closed somewhere between attempt 5 and attempt 12."
Most reps stop at 2. Drill follow-up cadences.
•
Take-away close.
"You know what, this might not be a fit. Let me ask — is the roof keeping you up at night, or are we doing this just to do it?" Pulling away triggers re-engagement.
•
"Price is a myth. There''s no such thing as price — only payments and value."
Stop debating sticker. Debate monthly impact, lifetime cost, replacement avoided.','[]'::jsonb,'[]'::jsonb,116,6)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701007','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Brian Tracy — Psychology of Selling','•
The Law of 6.
Every prospect has 6 reasons they''d buy — but only 1 or 2 dominate. Your job is to find the dominant buying motive (DBM) early. Ask: "If we did this, what would it solve for you first?"
•
Approach close.
Walk in already assuming the sale is happening. Body, voice, posture. They mirror your certainty.
•
Summary close.
Before asking for the agreement, recap their words back to them in order. "So just to recap — you''re concerned about the leak above the kitchen, you want this done before the kids are home for break, and your budget is in the 12-15 range. We''re solving all three." Their nod is the close.','[]'::jsonb,'[]'::jsonb,117,7)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701008','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Chet Holmes — The Stadium Pitch','Holmes'' famous insight: in any market, only
3% are actively buying right now
. Another 7% are open. The other 90% are
not
in market — but they will be eventually.
•
The pitch isn''t about the product, it''s about the problem the product solves.
When you talk to a homeowner whose roof is fine, don''t pitch your shingles — pitch
"the 5 hidden ways a roof costs you money before it leaks."
Now the 87% who aren''t in-market still want to listen.
•
The dream buyer list.
Make a written list of the 100 best prospects on your patch. Property managers, HOAs, large commercial buildings, multi-property landlords. Touch each one every two weeks for a year. By month 12 you own the territory.
•
The pig-headed discipline.
Pick a number of touches per week and do it no matter what. The reps who win are not the smart ones — they''re the ones who don''t break the cadence.','[]'::jsonb,'[]'::jsonb,159,8)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555701009','11111111-2222-4333-8444-555555600001','11111111-2222-4333-8444-555555555501','Neil Rackham — SPIN Selling (for bigger commercial deals)','SPIN is built for bigger-ticket B2B. For commercial roofing, property managers, REITs, HOAs — this is your framework. Less useful for a $9k residential shingle replacement, essential for a $300k TPO re-cover.
•
Situation
— fact-finding. "How many buildings in your portfolio? What''s the roof age on each? Any active leaks?"
•
Problem
— pain discovery. "What roofing issue has cost you the most this past 12 months?"
•
Implication
— make the pain bigger. "If that leak shows up again next storm, what''s the tenant ramification? What''s it cost you in retention?"
•
Need-Payoff
— let
them
articulate the solution''s value. "If we eliminated that leak permanently and warrantied 20 years, what would that be worth to you in tenant calls saved?"','[]'::jsonb,'[]'::jsonb,123,9)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600002','11111111-2222-4333-8444-555555555501','🎯 Lead Generation Engine','Leads aren''t found — they''re
manufactured
. Five channels, run them all.','sec-leadgen',2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555702000','11111111-2222-4333-8444-555555600002','11111111-2222-4333-8444-555555555501','The 5 Channels Every Trades Rep Runs in Parallel','1. Door-to-Door
Highest conversion, lowest scale. Your control mechanism.
2. Cold Calling
High volume, fast feedback, scripts compound.
3. Cold Outreach
SMS / Email / DMs. Async, scalable, asynchronous trust.
4. Networking & Referrals
Slowest to start, highest LTV, year-2 income source.
5. Storm / Event Spotting
Hail, wind, age-of-neighborhood. The asymmetric channel.
6. Inbound Authority
Google reviews, Nextdoor, NextDoor posts, FB groups — long-term.
Rule: never run fewer than 3 of these at once. If one dries up (winter slowdown, no storms, lawsuit pause) you don''t starve.','[]'::jsonb,'[]'::jsonb,88,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555702001','11111111-2222-4333-8444-555555600002','11111111-2222-4333-8444-555555555501','Storm Spotting — The Asymmetric Channel','•
Hail map subscriptions:
HailTrace, Interactive Hail Maps, NOAA SPC archive. Daily check, screenshot the polygons.
•
Wind events > 58 mph
usually qualify for an insurance look. Map these too.
•
Within 48-72 hours of a confirmed storm
— be on those streets. Adjusters are already booking. If you''re the first knock, you''re the contractor on the claim.
•
Drone scan + free inspection
is the asset. "Here''s what we found on your neighbor''s roof" is the opener.
•
The angle is NOT "you should file a claim."
The angle is "let''s see if you have damage that''s worth filing a claim over." Big legal difference, big rapport difference.','[]'::jsonb,'[]'::jsonb,110,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555702002','11111111-2222-4333-8444-555555600002','11111111-2222-4333-8444-555555555501','Insurance Adjuster Relationships','Adjusters are your most underrated referral source. They see every claim. They know which roofs are getting denied for bad install work. They know which contractors close cleanly.
•
Show up to claim ride-alongs prepared.
Ladder ready, drone charged, measuring app open. Know the policy basics: ACV vs RCV, depreciation recoverable, supplements.
•
Never argue with an adjuster on-site.
Argue politely in writing afterwards. The adjuster who likes you sends you 3-5 leads a year.
•
The 3-adjuster rule:
aim to have a working relationship with at least 3 adjusters from 3 different carriers. Drop off a coffee on a Tuesday. That''s the ask.','[]'::jsonb,'[]'::jsonb,104,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555702003','11111111-2222-4333-8444-555555600002','11111111-2222-4333-8444-555555555501','Real Estate Agent & Inspector Referrals','•
Pre-listing inspections
— agents need a contractor who can give a same-day "good enough to sell as-is" or "needs replacement" call. Be the one they trust.
•
Post-inspection repairs
— when a buyer''s inspector flags a roof, the listing agent needs a 24-hour bid. If you''re that contractor, you get every one of their listings.
•
The handoff fee.
Some markets, a $200-500 referral fee to the agent is normal and legal (check state). In others it''s strictly a "favor for a favor." Know your market.
•
Inspectors:
bring them coffee. Ask what trends they''re seeing. They will absolutely tell you which streets are due for replacement.','[]'::jsonb,'[]'::jsonb,108,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555702004','11111111-2222-4333-8444-555555600002','11111111-2222-4333-8444-555555555501','Property Manager / HOA / Multi-Family Outreach','This is the commercial gold mine and most residential reps ignore it.
•
Build a list of every property management company in a 25-mile radius. NARPM directory + local commercial listings. Aim for 50+ on the list.
•
Outreach cadence: cold call → handwritten note → LinkedIn → drop-by with donuts → 90-day repeat.
It takes 6-9 touches
. Reps quit at 2.
•
Their pain isn''t roofs. Their pain is
tenant complaints, owner complaints, and budget surprises
. Pitch in their language: "we eliminate the 3am leak call."
•
One signed PM relationship = 10-40 roofs a year, recurring. Worth ten residential closes.','[]'::jsonb,'[]'::jsonb,104,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555702005','11111111-2222-4333-8444-555555600002','11111111-2222-4333-8444-555555555501','Inbound Authority — The Slow Burn','•
Google reviews are the new yellow pages.
Goal: 100 reviews, 4.8+ stars. Ask at the moment of joy: when the crew leaves and the roof looks great. Send the link by text within an hour.
•
Nextdoor posts:
"Anyone recommend a roofer?" — set alerts. Be the second or third response, never the first (looks spammy). Drop a real customer''s review.
•
Facebook neighborhood groups:
same play. Helpful comments build authority over 6-12 months.
•
YouTube / TikTok:
60-second "what we found on a roof today" videos. Free, viral-able, builds you into a local personality. Tate, Ramsey, Belfort all built audiences before they sold.','[]'::jsonb,'[]'::jsonb,105,5)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','🚪 Door-to-Door Combat Manual','Pre-pitch setup, the walk-up, the open, reading the door, handling the no. Built for every trade.','sec-d2d',3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703000','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','Pre-Pitch Setup (Before You Even Park)','The Uniform
•
Polo with company logo (not T-shirt). Tucked in. Belt visible.
•
Clean jeans or work pants. No basketball shorts. No sandals. Ever.
•
Badge on a lanyard or clipped to belt. Company name + your photo + name big.
•
Clipboard with branded paperwork visible. The clipboard is a psychological weapon — it screams "this is official."
•
Hat optional but team hat > ballcap with random logo.
The Truck
•
Parked one or two houses past — never directly in their driveway.
•
Wrapped or magnetic signs. Their neighbors should be able to see your company name from 3 doors down.
•
Ladder visible. "Real contractor energy" beats "vague door knocker energy."
The Loadout
•
Phone with drone footage of recent local jobs queued up
•
Tablet or paper "free roof inspection" form
•
2-3 shingle samples or material swatches in a small bag
•
Business cards (still useful)
•
Door hangers for non-answers
The Mental Pre-Game (60 seconds in the truck)
•
Three breaths in through nose, out through mouth.
•
Smile at yourself in the rear-view mirror. Hold it for 5 seconds.
•
Say the opener out loud once. Out loud. Not in your head.
•
Tell yourself: "I''m here to help. If they say no, I say thank you and walk."','[]'::jsonb,'[]'::jsonb,218,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703001','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','The Walk-Up & The 5-Second Pattern Interrupt','The walk-up reads
Before you knock, you''ve already clocked: roof age (granule loss, curled tabs, missing shingles), gutters (separating, debris), siding/paint (wealth signal), kids'' bikes (family home), no car in driveway (likely empty), security camera (smile, you''re being filmed), Ring doorbell (assume the audio is rolling), Tesla / Bronco / Hellcat in the driveway (cash signal but also "I just spent it"), HOA flag on the lawn (restricted neighborhood — be ready). Everything feeds your opener.
The Knock
Two firm knocks. Pause 2 seconds. Ring doorbell once. Step back
3-4 feet
from the door. Hands visible. Clipboard at your side, not raised. If a Ring camera is staring at you, look at it once, smile, give a little nod. Then turn back to the door.
The Modern Opener — Built for the Over-Knocked Homeowner
Your prospect has been knocked 4-15 times this month. The "drone scan / your neighbors / hail bruising" speech is dead the moment they hear "drone." Generic doesn''t work. You need to
lampshade the saturation
, sound like a human, and earn the next 10 seconds with wit and specificity. Three things every opener should do now:
•
Acknowledge they''ve been knocked.
Disarm with self-awareness. "I know — another roofer."
•
Make a promise.
"30 seconds and I''m gone if it''s not interesting."
•
Skip the pitch — go straight to a question only they can answer.
Questions earn time. Pitches lose it.
The Witty Opener Bank
Five tested openers. Pick the one that matches the door, the homeowner, and the mood. Rotate. Never use the same opener twice on the same street.
Opener #1 — "I Know" (Universal Disarm)
Copy
"Hey — I know. Another roofer. I owe you 30 seconds and then I''m gone. Quick question — has your insurance company sent you any ''we regret to inform you'' love letters about your roof this year, or are you still in the clear?"
Opener #2 — The Insurance Drop (South Florida / coastal)
Copy
"Hey — quick one, then I''m out of your hair. The insurance companies are dropping homeowners in [BROWARD / MIAMI-DADE / PALM BEACH] faster than they can issue policies. Roofs over 12 years are getting non-renewed across the board, and the new policies are tripling in cost. Two questions: how old is your roof, and has your carrier said anything yet?"
Opener #3 — Metal Roof / Premium Savings
Copy
"Hi — I''ll be quick. Are you aware that swapping from asphalt to a wind-rated metal roof in Florida cuts your homeowners premium 30-70% from the wind mitigation credit alone? Most homeowners on this street don''t know that. The roof basically pays for itself out of premium savings. Want me to run the math on yours? 8 minutes, no charge."
Opener #4 — The Self-Aware Drone Reference
Copy
"I''ll skip the ''we were on your neighbor''s roof yesterday'' speech because you''ve heard it 12 times this month. Real reason I''m here — your roof from the street has [specific observation: granule loss / curled tabs / a wavy ridge line / dark streaking]. If insurance is still your carrier and that''s storm-related, you''ve got money on the table. Have you filed anything this year?"
Opener #5 — The Permit Office Angle
Copy
"Hey [NAME] — quick reason. We pulled the permit records on this block and your house is one of the ones that hasn''t had a roof permit pulled in [#] years. Combined with what I can see from the street, you''re sitting in the highest-risk window for non-renewal and the highest-payout window for an insurance claim, at the same time. 8 minutes worth checking?"
The rules:
Specific over generic. Wit over scripted. Question over pitch. Promise an exit. Then ask the one thing only they can answer.','["Opener #1 — \"I Know\" (Universal Disarm)\nCopy\n\"Hey — I know. Another roofer. I owe you 30 seconds and then I''m gone. Quick question — has your insurance company sent you any ''we regret to inform you'' love letters about your roof this year, or are you still in the clear?\"", "Opener #2 — The Insurance Drop (South Florida / coastal)\nCopy\n\"Hey — quick one, then I''m out of your hair. The insurance companies are dropping homeowners in [BROWARD / MIAMI-DADE / PALM BEACH] faster than they can issue policies. Roofs over 12 years are getting non-renewed across the board, and the new policies are tripling in cost. Two questions: how old is your roof, and has your carrier said anything yet?\"", "Opener #3 — Metal Roof / Premium Savings\nCopy\n\"Hi — I''ll be quick. Are you aware that swapping from asphalt to a wind-rated metal roof in Florida cuts your homeowners premium 30-70% from the wind mitigation credit alone? Most homeowners on this street don''t know that. The roof basically pays for itself out of premium savings. Want me to run the math on yours? 8 minutes, no charge.\"", "Opener #4 — The Self-Aware Drone Reference\nCopy\n\"I''ll skip the ''we were on your neighbor''s roof yesterday'' speech because you''ve heard it 12 times this month. Real reason I''m here — your roof from the street has [specific observation: granule loss / curled tabs / a wavy ridge line / dark streaking]. If insurance is still your carrier and that''s storm-related, you''ve got money on the table. Have you filed anything this year?\"", "Opener #5 — The Permit Office Angle\nCopy\n\"Hey [NAME] — quick reason. We pulled the permit records on this block and your house is one of the ones that hasn''t had a roof permit pulled in [#] years. Combined with what I can see from the street, you''re sitting in the highest-risk window for non-renewal and the highest-payout window for an insurance claim, at the same time. 8 minutes worth checking?\""]'::jsonb,'[]'::jsonb,629,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703002','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','The Claim-Process Icebreaker (The Real Second Question)','Once you''ve earned 30 seconds with the opener, don''t pitch the roof. Pitch the
conversation
. The single best icebreaker in storm/insurance work is:
The Master Icebreaker
Copy
"Real quick — where are you at in the claim process right now?"
That question does five things in one breath: qualifies the lead, assumes competence (flatters them), reveals their exact stage, gives you a branch to follow, and sounds like a peer asking — not a salesman pitching. Their answer puts them in one of
five buckets
— each with its own next move.
🟢 Bucket A — "What claim?" / "I haven''t filed anything."
They''re unaware or have written it off. Educate, don''t pitch.
Branch A Response
Copy
"Got it — most homeowners on this street are in the same boat. Here''s the thing: [STORM DATE] dropped enough hail/wind through this neighborhood that 6 out of 10 homes I scan still qualify for a claim. Asphalt damage doesn''t leak right away — it ages the roof, shows up as a leak 12-18 months later, and by then your claim window has closed. Free drone scan tells us if you''ve got anything worth filing. Yes or no?"
🟡 Bucket B — "I already have a contractor."
Don''t try to steal the deal. Position as second opinion.
Branch B Response
Copy
"Smart — that''s what I''d do too. All I''m offering is a free second-opinion drone scan. Either your guy nailed the scope and we confirm it, or we catch something they missed and I send you the photos to give them. Either way you win. Has the adjuster been out yet?"
Follow up: ask who the contractor is. If it''s a known fly-by-night, gently warn. If it''s a respected local company, congratulate them and ask for the referral introduction. Never bash a competitor — it makes you look small.
🔴 Bucket C — "I got denied."
This is your favorite answer.
Denials flip on re-inspection 30-40% of the time when documentation is properly built. This is high-value, low-competition work.
Branch C Response
Copy
"That''s actually what we specialize in. 40% of denials in [METRO] flip when somebody re-documents the damage properly and pushes a re-inspection. Three quick questions: when was it denied, who was the carrier, and did the adjuster cite ''cosmetic'' or ''no functional damage''? Because if it was either of those, there''s a play."
🔵 Bucket D — "I have a Public Adjuster / Attorney."
Don''t fight them. Become useful to them. PAs and attorneys love contractors who write clean scopes and respond quickly.
Branch D Response
Copy
"Good move — that''s the right play when carriers are stalling. Most attorneys and PAs we work with actually prefer when we coordinate scope and supplements with them — saves them hours and tightens the case. Who are you working with? I want to make sure they have my direct line for when they need someone on the roof."
⚪ Bucket E — "I''m still waiting on the adjuster" / "I filed but nothing''s happened."
You''re in the most leveraged spot. Position yourself as the rep who will be on the roof
with
the adjuster.
Branch E Response
Copy
"That''s the most important meeting in your entire claim. Whoever''s on the roof with the adjuster sets the scope. If nobody''s there representing you, the adjuster writes the minimum and you eat the rest. When are they coming? I want to be there with you. Free, no obligation, you don''t sign anything until you see what they write."','["The Master Icebreaker\nCopy\n\"Real quick — where are you at in the claim process right now?\"", "Branch A Response\nCopy\n\"Got it — most homeowners on this street are in the same boat. Here''s the thing: [STORM DATE] dropped enough hail/wind through this neighborhood that 6 out of 10 homes I scan still qualify for a claim. Asphalt damage doesn''t leak right away — it ages the roof, shows up as a leak 12-18 months later, and by then your claim window has closed. Free drone scan tells us if you''ve got anything worth filing. Yes or no?\"", "Branch B Response\nCopy\n\"Smart — that''s what I''d do too. All I''m offering is a free second-opinion drone scan. Either your guy nailed the scope and we confirm it, or we catch something they missed and I send you the photos to give them. Either way you win. Has the adjuster been out yet?\"", "Branch C Response\nCopy\n\"That''s actually what we specialize in. 40% of denials in [METRO] flip when somebody re-documents the damage properly and pushes a re-inspection. Three quick questions: when was it denied, who was the carrier, and did the adjuster cite ''cosmetic'' or ''no functional damage''? Because if it was either of those, there''s a play.\"", "Branch D Response\nCopy\n\"Good move — that''s the right play when carriers are stalling. Most attorneys and PAs we work with actually prefer when we coordinate scope and supplements with them — saves them hours and tightens the case. Who are you working with? I want to make sure they have my direct line for when they need someone on the roof.\"", "Branch E Response\nCopy\n\"That''s the most important meeting in your entire claim. Whoever''s on the roof with the adjuster sets the scope. If nobody''s there representing you, the adjuster writes the minimum and you eat the rest. When are they coming? I want to be there with you. Free, no obligation, you don''t sign anything until you see what they write.\""]'::jsonb,'[]'::jsonb,586,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703003','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','The "Not Interested" Reframe — They Don''t Want to Pay Cash','When a homeowner says "not interested"
after
you''ve established they have damage or an aging roof, assume one thing:
they don''t want to pay cash
. Almost nobody objects to a new roof on principle. They object to writing a $14,000 check. That''s it. Solve that and the deal opens. Three paths in: grants, insurance, and the premium-replacement math.
The Three Paths In (memorize them)
•
Grants
— state & local programs that pay homeowners directly to upgrade roofs to wind-mitigation standards. In Florida,
My Safe Florida Home (MSFH)
gives up to $10k. Other states have similar programs.
•
Insurance / Act-of-God claim
— if there''s
any
qualifying storm damage, insurance pays the bulk and the homeowner''s only out-of-pocket is the deductible.
•
Premium-to-Payment Math
— when insurance dropped them or tripled rates, the new roof financing payment
replaces
the premium hike. Net cost: near zero. Often
net savings
.
The "Not Interested" Reframe — Master Script
Copy
"Totally fair — and honestly, most of the homeowners who tell me ''not interested'' aren''t actually uninterested in the roof. They''re not interested in writing a $14k check. Fair enough. Here''s the thing though — I''m not asking you to write that check. There are three ways this gets paid for and zero of them are ''cash out of your savings.'' Want me to walk through the three real quick, and if none of them fit, I''m gone? 90 seconds."
Path 1 — The Grant Pitch (Florida)
My Safe Florida Home (MSFH)
Copy
"The state of Florida has a grant program called My Safe Florida Home — they give homeowners up to $10,000 to upgrade roofs to wind-mitigation standards. It''s not a loan, it''s a grant. The homestead requirement is straightforward. Combined with what insurance might pay, a lot of folks end up paying almost nothing out of pocket. Want me to check your eligibility while I''m here? 5 minutes."
Adjust the program name in other states (e.g., NC''s "Strengthen Your Home," AL''s "Strengthen Alabama Homes"). Know your state''s program cold — it''s a deal-maker.
Path 2 — The Act-of-God Insurance Pitch
Storm / Act-of-God Reframe
Copy
"If you''ve had
any
hail or wind event in the last 12-24 months — and this neighborhood definitely has — that''s not your roof, that''s an act of God. Insurance pays for those. Your only out-of-pocket is your deductible. So if your deductible is $2,500 and the roof is a $14k job, that''s a $2,500 decision, not a $14k decision. Different conversation, right? Let me drone-scan it and we''ll know in 8 minutes whether the storm angle is on the table."
Path 3 — Premium-to-Payment Math (the killer in 2025+ insurance markets)
This works in any market where insurance has spiked or carriers are dropping. Most of Florida, Texas, Louisiana, Colorado, California fire zones.
The Premium-to-Payment Math
Copy
"Quick question — what did your homeowners insurance go up this year? [Wait — they''ll tell you. $200/mo, $400/mo, sometimes more.] OK so let''s say your premium went up $250 a month. That''s $3,000 a year you''re now paying for the privilege of having a roof your carrier doesn''t even like. Here''s the move: if we put a wind-rated metal or impact-resistant roof on this house, your premium drops 30-70% from the wind mitigation credit. Meanwhile, the financing on the new roof is around $200-$280 a month. You''re
literally moving the same money
from a premium that''s going up every year to a roof payment that''s fixed for 10 years — and when it''s paid off, you own a metal roof that lasts 50 years and a premium that stays low. The math is on your side. Want me to put numbers on it?"
The Three-Path Close
Three-Path Close
Copy
"So three doors: grant money, insurance, or premium-swap financing. Most homeowners we work with use two of the three. Worst case, one applies. Best case, all three stack and your out-of-pocket is your deductible or less. Mind if I do the 8-minute drone scan so we know which doors are actually open for your house?"','["The \"Not Interested\" Reframe — Master Script\nCopy\n\"Totally fair — and honestly, most of the homeowners who tell me ''not interested'' aren''t actually uninterested in the roof. They''re not interested in writing a $14k check. Fair enough. Here''s the thing though — I''m not asking you to write that check. There are three ways this gets paid for and zero of them are ''cash out of your savings.'' Want me to walk through the three real quick, and if none of them fit, I''m gone? 90 seconds.\"", "My Safe Florida Home (MSFH)\nCopy\n\"The state of Florida has a grant program called My Safe Florida Home — they give homeowners up to $10,000 to upgrade roofs to wind-mitigation standards. It''s not a loan, it''s a grant. The homestead requirement is straightforward. Combined with what insurance might pay, a lot of folks end up paying almost nothing out of pocket. Want me to check your eligibility while I''m here? 5 minutes.\"", "Storm / Act-of-God Reframe\nCopy\n\"If you''ve had\nany\nhail or wind event in the last 12-24 months — and this neighborhood definitely has — that''s not your roof, that''s an act of God. Insurance pays for those. Your only out-of-pocket is your deductible. So if your deductible is $2,500 and the roof is a $14k job, that''s a $2,500 decision, not a $14k decision. Different conversation, right? Let me drone-scan it and we''ll know in 8 minutes whether the storm angle is on the table.\"", "The Premium-to-Payment Math\nCopy\n\"Quick question — what did your homeowners insurance go up this year? [Wait — they''ll tell you. $200/mo, $400/mo, sometimes more.] OK so let''s say your premium went up $250 a month. That''s $3,000 a year you''re now paying for the privilege of having a roof your carrier doesn''t even like. Here''s the move: if we put a wind-rated metal or impact-resistant roof on this house, your premium drops 30-70% from the wind mitigation credit. Meanwhile, the financing on the new roof is around $200-$280 a month. You''re\nliterally moving the same money\nfrom a premium that''s going up every year to a roof payment that''s fixed for 10 years — and when it''s paid off, you own a metal roof that lasts 50 years and a premium that stays low. The math is on your side. Want me to put numbers on it?\"", "Three-Path Close\nCopy\n\"So three doors: grant money, insurance, or premium-swap financing. Most homeowners we work with use two of the three. Worst case, one applies. Best case, all three stack and your out-of-pocket is your deductible or less. Mind if I do the 8-minute drone scan so we know which doors are actually open for your house?\""]'::jsonb,'[]'::jsonb,678,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703004','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','South Florida Insurance Crisis Playbook (deep dive)','The SoFla market is unlike anywhere else in the country right now. Non-renewals, Citizens overload, mortgage lenders requiring re-roofs, premium spikes 2-3x — every door in Broward / Miami-Dade / Palm Beach has a story. Reps who know the landscape close at 2-3x the rate of generalists.
What''s Actually Happening (so you sound like you know your stuff)
•
Carriers are pulling out of FL or non-renewing.
Universal, Citizens, Heritage, FedNat — major moves over the last 5 years. Homeowners are being shunted to Citizens (state-backed last resort) or specialty carriers at 2-3x premium.
•
Roofs over 12-15 years
are getting non-renewed or denied coverage outright. Some carriers won''t write any roof over 10 years.
•
Mortgage lenders
require continuous coverage. If insurance non-renews and the homeowner can''t get a replacement policy, the lender can force-place insurance at 3-5x the cost, or worse — call the loan.
•
Wind mitigation credits
are huge in FL. A new wind-rated roof (especially metal or stone-coated steel) can knock 30-70% off the premium, depending on the wind mit inspection result.
•
My Safe Florida Home (MSFH)
grant — up to $10k for qualifying homeowners to upgrade to wind-mitigation standards. Real money, free, the state literally wants to give it away.
The SoFla Master Talk Track
SoFla Master Talk Track
Copy
"Real quick on what''s happening in [BROWARD / MIAMI-DADE / PALM BEACH] right now, in case nobody''s broken this down for you. Three things, 60 seconds.
One — carriers are non-renewing roofs over 12 years across the board. Doesn''t matter how good shape it''s in. Your asphalt roof is on the clock.
Two — if you get dropped and Citizens picks you up, your premium roughly triples. We''re seeing $3,200/year policies turning into $9-10k.
Three — a wind-rated metal roof with the wind mit inspection knocks your premium 30-70%. So homeowners are paying their old premium and putting a new metal roof on the house — and the math still wins. Plus the state of Florida has the My Safe Florida Home grant — up to $10k toward exactly this upgrade.
The question isn''t whether you replace the roof. It''s whether you replace it now while grants and insurance are still on the table, or in 18 months when you''re already on Citizens at triple rate. Make sense?"
SoFla-Specific Closes
Close — The Non-Renewal Clock
Copy
"Your roof is currently the asset standing between you and a 3x premium hike. Every month we wait, your carrier is closer to writing a non-renewal letter. The homeowners who get ahead of it pay one premium and one financed payment that replaces it. The ones who wait pay a tripled premium and still have to replace the roof. Want to get ahead of it?"
Close — The Mortgage Risk
Copy
"Worst case here isn''t ''old roof.'' Worst case is force-placed insurance from your lender — that''s 3-5x normal premium, and it doesn''t even cover your stuff, only the lender''s. Or worse, the lender calls the loan because you''re out of compliance. Both of those happen in Florida every week. A new wind-rated roof shuts the door on both risks. That''s the actual value here."
What to Ask in the SoFla Conversation
•
"Who''s your carrier?" → Tells you risk level.
•
"When does your policy renew?" → Tells you the urgency.
•
"Has the carrier asked for a wind mit inspection or a 4-point recently?" → Means non-renewal is being considered.
•
"Have you gotten any non-renewal letters in the last 18 months?" → If yes, immediate priority lead.
•
"How much did your premium go up this year?" → Sets up the premium-swap math.','["SoFla Master Talk Track\nCopy\n\"Real quick on what''s happening in [BROWARD / MIAMI-DADE / PALM BEACH] right now, in case nobody''s broken this down for you. Three things, 60 seconds.\nOne — carriers are non-renewing roofs over 12 years across the board. Doesn''t matter how good shape it''s in. Your asphalt roof is on the clock.\nTwo — if you get dropped and Citizens picks you up, your premium roughly triples. We''re seeing $3,200/year policies turning into $9-10k.\nThree — a wind-rated metal roof with the wind mit inspection knocks your premium 30-70%. So homeowners are paying their old premium and putting a new metal roof on the house — and the math still wins. Plus the state of Florida has the My Safe Florida Home grant — up to $10k toward exactly this upgrade.\nThe question isn''t whether you replace the roof. It''s whether you replace it now while grants and insurance are still on the table, or in 18 months when you''re already on Citizens at triple rate. Make sense?\"", "Close — The Non-Renewal Clock\nCopy\n\"Your roof is currently the asset standing between you and a 3x premium hike. Every month we wait, your carrier is closer to writing a non-renewal letter. The homeowners who get ahead of it pay one premium and one financed payment that replaces it. The ones who wait pay a tripled premium and still have to replace the roof. Want to get ahead of it?\"", "Close — The Mortgage Risk\nCopy\n\"Worst case here isn''t ''old roof.'' Worst case is force-placed insurance from your lender — that''s 3-5x normal premium, and it doesn''t even cover your stuff, only the lender''s. Or worse, the lender calls the loan because you''re out of compliance. Both of those happen in Florida every week. A new wind-rated roof shuts the door on both risks. That''s the actual value here.\""]'::jsonb,'[]'::jsonb,609,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703005','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','The Three Doors (Yes, No, Maybe)','Door 1: "Yes, sure, come look"
30% of the time, if your opener is sharp. Don''t celebrate. Walk to the roof side, set up drone or ladder, narrate what you''re seeing, take photos. Take your time. Build trust through competence on the spot.
Door 2: "Not interested" (the reflex no)
80% of first no''s are pre-trained gatekeeping. Don''t fight. Reframe.
Reflex-No Reframe
Copy
"Totally fair — most people aren''t until they see what''s actually up there. Real quick — when''s the last time anybody actually looked at your roof? Because what we''re seeing from the street is the kind of thing insurance pays for, not you. If we find nothing, you''ve lost nothing. If we find something, I just saved you a deductible. Worth 8 minutes?"
Door 3: "I''ll think about it" / "Send me info"
This is the maybe — the dangerous one. Don''t leave a card and walk. Pin the next step.
"Send me info" Reframe
Copy
"I can do better than info — info doesn''t tell you what''s on your specific roof. Here''s what I''d suggest: I''m in this neighborhood Thursday morning and Saturday at 10. I''ll come back, drone-scan it, and we''ll know in 15 minutes whether there''s anything to even talk about. Which is easier — Thursday or Saturday?"
Alternate of choice. Never "do you want to schedule" — always "Thursday or Saturday."','["Reflex-No Reframe\nCopy\n\"Totally fair — most people aren''t until they see what''s actually up there. Real quick — when''s the last time anybody actually looked at your roof? Because what we''re seeing from the street is the kind of thing insurance pays for, not you. If we find nothing, you''ve lost nothing. If we find something, I just saved you a deductible. Worth 8 minutes?\"", "\"Send me info\" Reframe\nCopy\n\"I can do better than info — info doesn''t tell you what''s on your specific roof. Here''s what I''d suggest: I''m in this neighborhood Thursday morning and Saturday at 10. I''ll come back, drone-scan it, and we''ll know in 15 minutes whether there''s anything to even talk about. Which is easier — Thursday or Saturday?\""]'::jsonb,'[]'::jsonb,228,5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703006','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','Reading the Homeowner','The Cracked Door
Don''t push it open. Step back further. Drop volume. Smile bigger. They open the door if they feel safer.
Hands on Hips / Wide Stance
They''re prepared to say no. Lead with curiosity, not pitch. "Can I ask — how long have you been in the house?"
"My husband handles that"
Don''t write them off. Wife often controls the calendar. "Totally understand — when''s the easiest time to catch you both? I''d rather present once to the two of you than three times to one of you."
"My nephew is a roofer"
"Awesome — keep him in the loop. All I''m offering is a free second opinion with drone photos he can use. No charge, no pressure."
Elderly homeowner alone
Slow down. Don''t sit. Don''t take out paperwork unless invited. If there''s a child or relative they''d want to call, encourage it. Reputation is your business.
The dog at the door
Step back further. Compliment the dog. Many homeowners thaw when you treat the dog right.','[]'::jsonb,'[]'::jsonb,169,6)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703007','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','The Inspection — Convert the Free Look Into a Sit-Down','You got the yes. Now don''t blow it.
•
Narrate while you work.
"I''m pulling up the drone. I''m going to fly the four sides. I''m looking for impact marks, granule loss, sealant failure, and any spots where the deck''s showing."
•
Show them the photos on the spot.
Don''t say it — show it. Granules in the gutter. The bruise spots. The flashing gap.
•
Use the language of the adjuster.
"Hail bruising," "wind uplift," "creased shingle," "compromised seal" — sounds real, because it is.
•
Sit down before you quote.
Standing in the driveway is the wrong place to talk numbers. "Can we sit at the kitchen table real quick? I want to walk through the report and the two paths from here." (Alternate of choice baked in: "two paths.")
•
Always present "two paths."
Repair / Replace. Insurance / Out-of-pocket. Low / Mid. Never one option — always two. Two paths = real choice = no "let me think about it."','[]'::jsonb,'[]'::jsonb,164,7)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555703008','11111111-2222-4333-8444-555555600003','11111111-2222-4333-8444-555555555501','When to Walk Away','You can''t close every door. Knowing when to walk preserves your energy for the doors that pay.
•
Three real objections, three handled, still a no?
Walk. Leave the door hanger.
•
Hostile? Yelling? Threats?
"I''m sorry to bother you, have a great day." Smile, walk. Never escalate. Never. Note the address — don''t go back.
•
House has no roof problem AND no money AND no urgency?
Walk. Leave a card. They''ll need you in 2-5 years. Be the rep they remember.','[]'::jsonb,'[]'::jsonb,83,8)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600004','11111111-2222-4333-8444-555555555501','📞 Cold Calling Mastery','Phone is leverage. One headset, 100 dials, you talk to 25 people, you book 5, you close 2. Math is unforgiving — and beautiful.','sec-coldcall',4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555704000','11111111-2222-4333-8444-555555600004','11111111-2222-4333-8444-555555555501','Phone Setup & The Pre-Call Ritual','•
Stand up while you dial.
Voice carries from the diaphragm. Sitting = sounding tired even when you aren''t.
•
Headset, not handset.
Free hands = better notes = sharper recall.
•
Mirror on your desk.
Watch yourself talk. If your face is dead, your voice is dead.
•
One pen, one notebook, one CRM tab.
Don''t be hunting for stuff mid-call.
•
Smile
before
the line picks up.
A second is enough. The first syllable carries the smile.
•
Drink water between blocks, not during.
Dry mouth = small voice = uncertain rep.','[]'::jsonb,'[]'::jsonb,94,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555704001','11111111-2222-4333-8444-555555600004','11111111-2222-4333-8444-555555555501','The Opening 15 Seconds','Cold calling is more brutal than D2D in one specific way: they can''t see you, so tone is 100% of the trust. Your opener must do three things in 15 seconds:
•
Sound human, not scripted
•
Give them a reason to
not
hang up (specificity, curiosity, or value)
•
End with a question they have to answer (silence on your end is the close)
Master Cold Call Opener — Roofing (Residential)
Copy
"Hey [NAME], this is [REP] over at [COMPANY] — I know I''m calling you cold so I''ll be quick. We were doing drone work on [STREET / NEARBY ADDRESS] last week and we flagged what looks like hail and wind damage on a handful of homes on your block. Yours is on the list. Two questions: have you had anybody actually look at your roof this year, and would it be worth 10 minutes for me to send you the drone photos of what we''re seeing?"
Master Cold Call Opener — Commercial Property Manager
Copy
"Hi [NAME], this is [REP] with [COMPANY] — I''ll keep this to 30 seconds. We work specifically with property managers in [METRO] on commercial roof maintenance and replacement — the stuff that shows up at 2am as a tenant call. I''m not pitching you today. I''m asking one question: out of your portfolio, which 1 or 2 buildings have given you the most roof headaches in the last 12 months? Because that''s where we''d typically start."
Why these work:
they don''t ask permission to talk. They name a specific problem the prospect already has. They end with a question that opens the conversation rather than closing it.','["Master Cold Call Opener — Roofing (Residential)\nCopy\n\"Hey [NAME], this is [REP] over at [COMPANY] — I know I''m calling you cold so I''ll be quick. We were doing drone work on [STREET / NEARBY ADDRESS] last week and we flagged what looks like hail and wind damage on a handful of homes on your block. Yours is on the list. Two questions: have you had anybody actually look at your roof this year, and would it be worth 10 minutes for me to send you the drone photos of what we''re seeing?\"", "Master Cold Call Opener — Commercial Property Manager\nCopy\n\"Hi [NAME], this is [REP] with [COMPANY] — I''ll keep this to 30 seconds. We work specifically with property managers in [METRO] on commercial roof maintenance and replacement — the stuff that shows up at 2am as a tenant call. I''m not pitching you today. I''m asking one question: out of your portfolio, which 1 or 2 buildings have given you the most roof headaches in the last 12 months? Because that''s where we''d typically start.\""]'::jsonb,'[]'::jsonb,275,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555704002','11111111-2222-4333-8444-555555600004','11111111-2222-4333-8444-555555555501','Voicemail Strategy','80% of cold dials hit voicemail. Don''t waste them. Don''t try to close on voicemail. The job of voicemail is to make the callback or the follow-up text feel warm.
Voicemail #1 — Cold
Copy
"Hey [NAME], [REP] over at [COMPANY] — drone work on your block flagged your roof on the list of likely hail damage. Just wanted to send you the photos before insurance season closes. Call me back at [NUMBER] or shoot me a text — same number. Thanks."
Voicemail #2 — Bump (3 days later)
Copy
"Hey [NAME], [REP] again — quick bump on the drone photos. Sending them via text right now in case voicemail''s not your thing. No worries either way."
Then immediately text:
"Hi [NAME] — [REP] from [COMPANY], just left you a voicemail. Drone caught a few spots on your roof I''d want a homeowner to see. Want me to send the photos?"
Triple-tap (call → voicemail → text in 60 seconds) lifts callback rate 3-4x vs. a single voicemail.','["Voicemail #1 — Cold\nCopy\n\"Hey [NAME], [REP] over at [COMPANY] — drone work on your block flagged your roof on the list of likely hail damage. Just wanted to send you the photos before insurance season closes. Call me back at [NUMBER] or shoot me a text — same number. Thanks.\"", "Voicemail #2 — Bump (3 days later)\nCopy\n\"Hey [NAME], [REP] again — quick bump on the drone photos. Sending them via text right now in case voicemail''s not your thing. No worries either way.\""]'::jsonb,'[]'::jsonb,168,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555704003','11111111-2222-4333-8444-555555600004','11111111-2222-4333-8444-555555555501','Decision-Maker Bypass (Commercial Calls)','Gatekeepers aren''t your enemy — they''re a filter. Treat them with respect; they remember you.
•
Use first names with the front desk.
"Hi Sarah, is Mike around?" not "Can I speak to Mr. Lawson?"
•
Sound like you''ve talked before, even if you haven''t.
"Hey, is Mike free? I was supposed to get him some info." (Not lying — you did intend to.)
•
If blocked: "Totally understand — what''s his best email?"
Now you have an email, AND you''ve extracted info politely.
•
The 7am / 6pm trick:
decision makers often pick up their own phone before 8am and after 5pm. The gatekeeper isn''t there.
•
The LinkedIn warm-up:
connect, comment on a post, then call 48 hours later. "Hi Mike, I''m the one who commented on your facilities post yesterday." Instant warmth.','[]'::jsonb,'[]'::jsonb,135,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555704004','11111111-2222-4333-8444-555555600004','11111111-2222-4333-8444-555555555501','Daily Quotas & Energy Management','Dial Volume
80-120 dials/day for residential rep. 60-80 for commercial rep with bigger ACV.
Talk Time
3 hours of
actual
conversations per 8-hour day = top decile.
Conversion Targets
25% pickup → 30% past opener → 20% booked → 30% close = ~1.5% dials-to-deal. Run the math.
The Block Method
Don''t dial all day. Dial in 90-minute blocks with 15-minute breaks. Two blocks before lunch, two after. Energy beats volume after hour 3.
The Recording Drill
Record one in five calls. Listen for: did I smile? did I pause? did I rush? did I let them talk 60% of the time? Find
one
thing to fix tomorrow. Not five. One.','[]'::jsonb,'[]'::jsonb,110,4)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600005','11111111-2222-4333-8444-555555555501','💬 Cold Outreach — SMS, Email, Social','Async channels. They don''t replace dials and doors — they amplify them.','sec-outreach',5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555705000','11111111-2222-4333-8444-555555600005','11111111-2222-4333-8444-555555555501','SMS Templates That Don''t Sound Spammy','SMS works when (a) you have a legit reason to text — neighbor, drone scan, recent storm — and (b) you keep it under 200 characters. Long texts get ignored. Compliance: identify yourself, give an opt-out, and check your state''s TCPA rules.
SMS #1 — Storm aftermath
Copy
Hi [NAME] — [REP] w/ [COMPANY]. We were on your block after the [STORM DATE] hail event & flagged a few homes incl. yours for possible damage. Want me to send the drone shots? Free, no pressure. Reply STOP to opt out.
SMS #2 — Referral name-drop
Copy
Hey [NAME] — [REFERRER] over on Elm gave me your name. We just finished his roof and he mentioned you might want a free inspection. Is now a bad time to text? — [REP], [COMPANY]
SMS #3 — Voicemail follow-up
Copy
Hi [NAME] — just left you a voicemail. Wanted to send the drone photos of your roof rather than play phone tag. Want them? — [REP], [COMPANY]
SMS #4 — Re-engagement (90 days)
Copy
Hey [NAME] — [REP] from [COMPANY], we drone-scanned your roof back in [MONTH]. Quick check-in: any new leaks or moisture since? If yes, I''ll get out there this week. If not, glad to hear it.','["SMS #1 — Storm aftermath\nCopy\nHi [NAME] — [REP] w/ [COMPANY]. We were on your block after the [STORM DATE] hail event & flagged a few homes incl. yours for possible damage. Want me to send the drone shots? Free, no pressure. Reply STOP to opt out.", "SMS #2 — Referral name-drop\nCopy\nHey [NAME] — [REFERRER] over on Elm gave me your name. We just finished his roof and he mentioned you might want a free inspection. Is now a bad time to text? — [REP], [COMPANY]", "SMS #3 — Voicemail follow-up\nCopy\nHi [NAME] — just left you a voicemail. Wanted to send the drone photos of your roof rather than play phone tag. Want them? — [REP], [COMPANY]", "SMS #4 — Re-engagement (90 days)\nCopy\nHey [NAME] — [REP] from [COMPANY], we drone-scanned your roof back in [MONTH]. Quick check-in: any new leaks or moisture since? If yes, I''ll get out there this week. If not, glad to hear it."]'::jsonb,'[]'::jsonb,206,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555705001','11111111-2222-4333-8444-555555600005','11111111-2222-4333-8444-555555555501','Cold Email — Trades / Commercial','Three rules: (1) subject line is a question or curiosity, never a pitch. (2) body is < 80 words. (3) one specific CTA, never "would love to connect."
Cold Email — Property Manager
Copy
Subject: 2am leak call question
Hi [NAME],
Out of the [#] buildings in your portfolio, which one has cost you the most in roof-related tenant calls this year?
I work with PMs in [METRO] on commercial roof maintenance — typically the buildings nobody wants to think about until they''re leaking.
If you''ve got a worst-offender, I''d come out and give you a no-charge condition report. No pitch, just a number.
Worth 20 minutes next week?
[REP]
[COMPANY] | [PHONE]
Cold Email — Real Estate Agent
Copy
Subject: roof bid in 24 hrs?
Hi [NAME],
I''m a roofer in [METRO] and most agents I work with hate the same thing: a buyer''s inspector flags the roof and suddenly the close date is in jeopardy.
I do 24-hour bids for agents — drone scan, written report, repair vs replace options. No surprise upsells, no agent fees.
If you want me on your shortlist for the next inspection drama, reply with "shortlist" and I''ll send my agent one-pager.
[REP]
[COMPANY]','["Cold Email — Property Manager\nCopy\nSubject: 2am leak call question\nHi [NAME],\nOut of the [#] buildings in your portfolio, which one has cost you the most in roof-related tenant calls this year?\nI work with PMs in [METRO] on commercial roof maintenance — typically the buildings nobody wants to think about until they''re leaking.\nIf you''ve got a worst-offender, I''d come out and give you a no-charge condition report. No pitch, just a number.\nWorth 20 minutes next week?\n[REP]\n[COMPANY] | [PHONE]", "Cold Email — Real Estate Agent\nCopy\nSubject: roof bid in 24 hrs?\nHi [NAME],\nI''m a roofer in [METRO] and most agents I work with hate the same thing: a buyer''s inspector flags the roof and suddenly the close date is in jeopardy.\nI do 24-hour bids for agents — drone scan, written report, repair vs replace options. No surprise upsells, no agent fees.\nIf you want me on your shortlist for the next inspection drama, reply with \"shortlist\" and I''ll send my agent one-pager.\n[REP]\n[COMPANY]"]'::jsonb,'[]'::jsonb,201,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555705002','11111111-2222-4333-8444-555555600005','11111111-2222-4333-8444-555555555501','Social DMs — LinkedIn, Facebook, Nextdoor','•
LinkedIn is for commercial only.
Property managers, facility directors, HOA presidents, multi-family asset managers, school district maintenance heads. Never use LinkedIn for residential.
•
Connect first, message after they accept.
The first message is never a pitch. It''s a comment on something they posted, or a question about their portfolio.
•
Facebook DMs work for residential storm response.
Geo-targeted neighborhood groups. "Saw the post about hail on Walnut — drone-scanned a few homes there yesterday. Want me to send the photos? No charge."
•
Nextdoor: never DM cold.
Build authority through helpful comments on roof-related posts for 6 months before any DM.
LinkedIn First Message — PM
Copy
Hi [NAME] — thanks for connecting. Saw you manage [PORTFOLIO TYPE / SIZE] in [METRO]. Quick question, not a pitch: which of your buildings has given you the most roof-related grief in the last 12 months? I work with PMs on the "won''t stop leaking" properties specifically — happy to share a no-charge condition report on your worst offender if useful.','["LinkedIn First Message — PM\nCopy\nHi [NAME] — thanks for connecting. Saw you manage [PORTFOLIO TYPE / SIZE] in [METRO]. Quick question, not a pitch: which of your buildings has given you the most roof-related grief in the last 12 months? I work with PMs on the \"won''t stop leaking\" properties specifically — happy to share a no-charge condition report on your worst offender if useful."]'::jsonb,'[]'::jsonb,170,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555705003','11111111-2222-4333-8444-555555600005','11111111-2222-4333-8444-555555555501','The 5-Touch Cadence Across Channels','One channel never wins. Stack them.
•
Day 1:
Cold call → voicemail → SMS in 60 seconds.
•
Day 3:
Cold email.
•
Day 5:
LinkedIn connect (commercial) OR door knock (residential storm).
•
Day 8:
Second cold call → voicemail → SMS.
•
Day 14:
Handwritten note in the mail. Yes, paper. Stops them in their tracks. 80% open rate.
If still no response by day 21: drop into a 90-day re-engagement list. Touch every 90 days for a year. Most deals close on touch 7-12.','[]'::jsonb,'[]'::jsonb,88,3)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600006','11111111-2222-4333-8444-555555555501','🤝 Networking & Referrals','Slowest channel to start, highest LTV. Your year-2 income comes from here.','sec-network',6)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555706000','11111111-2222-4333-8444-555555600006','11111111-2222-4333-8444-555555555501','The Referral Math','A closed customer who refers one neighbor = $9-15k. That''s a $9-15k follow-up call you never made. The reps who win year 2 don''t just close — they
convert closes into referrers
.
•
Ask at the moment of joy.
Crew leaves, roof looks great, homeowner walks out smiling. That''s when. Not 2 weeks later.
•
Ask specifically.
Not "know anyone who needs a roof" — "is there one neighbor on this block you''d hate to see go to a fly-by-night company?"
•
Give them a tool.
Branded postcard, $250 referral check, your card with their name on the back. Make it easy.
•
Close the loop.
When the referral closes, send the referrer a hand-signed thank you + the check + a photo of the new roof. They''ll send more.','[]'::jsonb,'[]'::jsonb,131,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555706001','11111111-2222-4333-8444-555555600006','11111111-2222-4333-8444-555555555501','BNI / Chamber / Trade Groups','•
BNI (Business Network International)
— one of you per category. Weekly meetings, structured referrals. Worth it in years 2-5 of your career, not year 1.
•
Local Chamber of Commerce
— slower than BNI but the network includes commercial decision-makers. Show up to mixers. Bring cards. Don''t pitch.
•
NARI / NAHB / NRCA
— trade-specific orgs. Membership = access to local trade-only events where adjusters, inspectors, and builders all hang out.
•
The "no-pitch rule" at networking events.
First 3 events at any new group = zero pitching. Just learn names, ask questions, be useful. Pitch in event 4+.','[]'::jsonb,'[]'::jsonb,101,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555706002','11111111-2222-4333-8444-555555600006','11111111-2222-4333-8444-555555555501','Subcontractor & Adjacent-Trade Relationships','The other trades on a property are an underrated referral source. They see what you don''t.
•
HVAC techs
are on roofs constantly. They see hail bruising before any rep. A 6-pack and a conversation = a multi-year referral pipeline.
•
Solar installers
can''t install over a bad roof. They need someone to call when the roof flunks. Be that person.
•
Gutter, siding, painters, pressure washers
— all see the roof. All have customer trust. All can refer.
•
Plumbers
when there''s a leak — they get called first. If they have a roofer they trust, they refer.
Cross-Trade Outreach Script
Copy
"Hey [NAME] — [REP] with [COMPANY], we''re the roofer that picks up the phone when you''ve got a customer with a roof issue you can''t touch. I''m not asking for a referral right now. I''m asking who you usually call when a customer''s roof is the problem — and if it''s not you happy with that person, I''d love a shot. Coffee on me, this week or next?"','["Cross-Trade Outreach Script\nCopy\n\"Hey [NAME] — [REP] with [COMPANY], we''re the roofer that picks up the phone when you''ve got a customer with a roof issue you can''t touch. I''m not asking for a referral right now. I''m asking who you usually call when a customer''s roof is the problem — and if it''s not you happy with that person, I''d love a shot. Coffee on me, this week or next?\""]'::jsonb,'[]'::jsonb,171,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555706003','11111111-2222-4333-8444-555555600006','11111111-2222-4333-8444-555555555501','The Referral Ask Script Bank','Crew-Done Ask (the gold one)
Copy
"The crew''s wrapping up — roof looks great, you should be set for the next 25+ years. One favor, no pressure: as we head out, is there a neighbor on this block you''d actually hate to see go to a bad roofer? If you''ve got a name, I''ll knock on their door this week with a referral discount and tell them you sent me. Worst case, they say no thanks."
90-Day Check-In Ask
Copy
"Hey [NAME] — [REP] from [COMPANY], you''re 90 days in on the new roof. Two things: first, any drips, any concerns? Second — quick favor — would you mind dropping a Google review? I''ll send the link via text. Takes 30 seconds, makes my year."
Review Request SMS
Copy
Hey [NAME] — [REP] here. Quick favor: would you drop a quick Google review on us? Anything you write is genuinely useful. Link: [REVIEW LINK]. Thanks 🙏','["Crew-Done Ask (the gold one)\nCopy\n\"The crew''s wrapping up — roof looks great, you should be set for the next 25+ years. One favor, no pressure: as we head out, is there a neighbor on this block you''d actually hate to see go to a bad roofer? If you''ve got a name, I''ll knock on their door this week with a referral discount and tell them you sent me. Worst case, they say no thanks.\"", "90-Day Check-In Ask\nCopy\n\"Hey [NAME] — [REP] from [COMPANY], you''re 90 days in on the new roof. Two things: first, any drips, any concerns? Second — quick favor — would you mind dropping a Google review? I''ll send the link via text. Takes 30 seconds, makes my year.\"", "Review Request SMS\nCopy\nHey [NAME] — [REP] here. Quick favor: would you drop a quick Google review on us? Anything you write is genuinely useful. Link: [REVIEW LINK]. Thanks 🙏"]'::jsonb,'[]'::jsonb,156,3)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','🏠 Roofing Systems Encyclopedia','11 systems. What they are, how they fail, what to pitch, and the exact scripts to use at the door and on the phone.','sec-roofs',7)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707000','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','Asphalt Shingles (3-tab & Architectural)','Lifespan
3-tab: 15-20 yrs. Arch: 25-30 yrs.
Avg Cost
$5-10/sqft installed
Market Share
~75% of US residential
How it fails
•
Granule loss → UV exposes asphalt → cracking
•
Curling tabs (wind uplift + age)
•
Hail bruising (impact marks, broken seal strips)
•
Algae streaking (cosmetic but signals age)
•
Flashing failure at chimneys, vents, valleys
•
Nail pops & missing tabs from wind
The pitch angle
For 95% of homeowners, asphalt is the default. They don''t need to be sold
asphalt
— they need to be sold
now vs. later
. Lean on hail/wind damage (insurance pays), warranty (peace of mind), and home value (1-for-1 ROI in most markets).
D2D — Asphalt
Copy
"Mr./Mrs. [NAME], roof looks like the original arch shingles from when the neighborhood was built — what, ''08, ''09? They''ve got maybe 5-7 good years left, which is fine, except you''ve got hail bruising on the south slope that means insurance might pay for the whole thing right now — and won''t in two years when they age out. 8 minutes with the drone tells us if you''re sitting on a free replacement. Worth the time?"
Cold Call — Asphalt
Copy
"Hi [NAME] — drone work in [NEIGHBORHOOD] flagged your roof on the list of likely hail bruising. Asphalt shingles past 12-15 years stop qualifying for full claims, so timing matters. Want me to send the drone shots so you can see what we saw?"','["D2D — Asphalt\nCopy\n\"Mr./Mrs. [NAME], roof looks like the original arch shingles from when the neighborhood was built — what, ''08, ''09? They''ve got maybe 5-7 good years left, which is fine, except you''ve got hail bruising on the south slope that means insurance might pay for the whole thing right now — and won''t in two years when they age out. 8 minutes with the drone tells us if you''re sitting on a free replacement. Worth the time?\"", "Cold Call — Asphalt\nCopy\n\"Hi [NAME] — drone work in [NEIGHBORHOOD] flagged your roof on the list of likely hail bruising. Asphalt shingles past 12-15 years stop qualifying for full claims, so timing matters. Want me to send the drone shots so you can see what we saw?\""]'::jsonb,'[]'::jsonb,241,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707001','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','Metal Roofing (Standing Seam, R-Panel, Stone-Coated Steel)','Lifespan
40-70 years
Avg Cost
$10-18/sqft installed
Best for
Long-term owners, high-wind/snow zones, fire-prone areas
How it fails
•
Fastener back-out (exposed fastener systems)
•
Sealant degradation at panel laps and penetrations
•
Oil canning (cosmetic — manage expectations)
•
Galvanic corrosion at dissimilar metal contact
•
Hail dents (cosmetic on most panels, structural rare)
The pitch angle
Metal is bought, not sold. The customer is usually already curious. Your job is to (1) qualify their lifetime intent, (2) protect them from cheap exposed-fastener installs, (3) sell standing seam if budget allows.
D2D — Metal Upsell from Asphalt
Copy
"Quick question — how long do you plan on being in this house? Because we''re seeing about 70% of replacements in this neighborhood going to standing seam metal lately. Costs more upfront, but it''s the last roof you''d ever buy. If you''re a 10+ year owner, the math works. If you''re 5 and out, we''d stick with arch shingles. Either way, I want to drone-scan first so we know what we''re working with."
Cold Call — Metal (commercial / agricultural)
Copy
"Hi [NAME] — calling because we do standing seam and R-panel work for commercial/ag buildings in [METRO], and metal roofs your age tend to start showing fastener back-out and seam failure around year 20-25. Has anyone done a sealant inspection on yours in the last 5 years? Because a $2k touch-up now usually saves a $40k re-cover later."','["D2D — Metal Upsell from Asphalt\nCopy\n\"Quick question — how long do you plan on being in this house? Because we''re seeing about 70% of replacements in this neighborhood going to standing seam metal lately. Costs more upfront, but it''s the last roof you''d ever buy. If you''re a 10+ year owner, the math works. If you''re 5 and out, we''d stick with arch shingles. Either way, I want to drone-scan first so we know what we''re working with.\"", "Cold Call — Metal (commercial / agricultural)\nCopy\n\"Hi [NAME] — calling because we do standing seam and R-panel work for commercial/ag buildings in [METRO], and metal roofs your age tend to start showing fastener back-out and seam failure around year 20-25. Has anyone done a sealant inspection on yours in the last 5 years? Because a $2k touch-up now usually saves a $40k re-cover later.\""]'::jsonb,'[]'::jsonb,238,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707002','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','Clay & Concrete Tile','Lifespan
50-100 yrs (tile). Underlayment 20-25 yrs.
Avg Cost
$10-25/sqft installed (relay $5-10/sqft)
Region
CA, AZ, FL, TX — Mediterranean/Spanish architecture
How it fails (this is the key insight)
The tile rarely fails — the underlayment does.
Most homeowners think their tile roof is fine because they see no cracked tiles. Meanwhile the underlayment beneath has aged out and is leaking into the deck.
This is the pitch.
•
Underlayment 20-25 yr lifespan
•
Cracked or slipped tiles from foot traffic or impact
•
Mortar failure at hips and ridges
•
Valley metal corrosion
D2D — Tile (the underlayment angle)
Copy
"Beautiful tile roof — what is that, ''02, ''03? Here''s the thing nobody tells homeowners about tile: the tile lasts 100 years, but the underlayment beneath only lasts 20-25. Most folks don''t replace it because the tile looks fine — and that''s exactly how decking rot starts. The good news: we can lift the tile, replace the underlayment, and reuse 90%+ of the original tile. Costs about half a full replacement. Want me to come up and pull a tile to show you what''s underneath?"
Cold Call — Tile (relay opportunity)
Copy
"Hey [NAME] — [REP] from [COMPANY]. Quick reason for the call: tile underlayment ages out around year 22-25 and we''re seeing a wave of homes in [NEIGHBORHOOD] hitting that age right now. A tile relay is roughly half what a new tile roof costs and you reuse most of your existing tile. Worth me coming out for a no-charge look?"','["D2D — Tile (the underlayment angle)\nCopy\n\"Beautiful tile roof — what is that, ''02, ''03? Here''s the thing nobody tells homeowners about tile: the tile lasts 100 years, but the underlayment beneath only lasts 20-25. Most folks don''t replace it because the tile looks fine — and that''s exactly how decking rot starts. The good news: we can lift the tile, replace the underlayment, and reuse 90%+ of the original tile. Costs about half a full replacement. Want me to come up and pull a tile to show you what''s underneath?\"", "Cold Call — Tile (relay opportunity)\nCopy\n\"Hey [NAME] — [REP] from [COMPANY]. Quick reason for the call: tile underlayment ages out around year 22-25 and we''re seeing a wave of homes in [NEIGHBORHOOD] hitting that age right now. A tile relay is roughly half what a new tile roof costs and you reuse most of your existing tile. Worth me coming out for a no-charge look?\""]'::jsonb,'[]'::jsonb,253,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707003','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','Slate','Lifespan
75-200 yrs (natural)
Avg Cost
$15-30/sqft installed
Region
Northeast, Mid-Atlantic — older & high-end homes
How it fails
•
Nail/fastener failure (slate stays, fasteners fail — slates slide)
•
Delaminating tiles (soft slate variants 60-100 yrs)
•
Flashing failure at chimneys, valleys, eaves
•
Improper foot traffic damage
The pitch angle
Slate clients are sophisticated. Don''t sell — diagnose. Lead with expertise: "most so-called slate contractors are actually doing slate-look composite. Real slate is its own craft. Here''s what we look at…"
D2D — Slate (high-end, low-volume)
Copy
"Beautiful slate — that looks like Vermont gray? With slate the slates themselves outlive the building, but the copper flashings and the nail fasteners age out at maybe 60-80 years. Has anyone evaluated the flashings on this roof recently? Because if you''re going to spend on slate repair, you want it done by someone who''s actually working slate — not asphalt guys with a ladder. Mind if I take a quick look?"','["D2D — Slate (high-end, low-volume)\nCopy\n\"Beautiful slate — that looks like Vermont gray? With slate the slates themselves outlive the building, but the copper flashings and the nail fasteners age out at maybe 60-80 years. Has anyone evaluated the flashings on this roof recently? Because if you''re going to spend on slate repair, you want it done by someone who''s actually working slate — not asphalt guys with a ladder. Mind if I take a quick look?\""]'::jsonb,'[]'::jsonb,161,3)
on conflict (id) do nothing;insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707004','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','Wood Shake / Cedar Shingle','Lifespan
20-40 yrs (climate dependent)
Avg Cost
$8-15/sqft installed
Watch-outs
Fire codes, insurance non-renewal in WUI zones
How it fails
•
Splitting, cupping, curling (UV + moisture cycles)
•
Moss & algae growth (Pacific NW especially)
•
Fire insurance non-renewal (huge in CA/CO/AZ wildfire zones)
•
Pest infiltration
The pitch angle
In wildfire zones, the angle is
insurance non-renewal
. Most cedar homes are getting dropped or having premiums doubled. Conversion to Class A fire-rated (asphalt, metal, tile) saves the policy.
D2D — Cedar in wildfire zone
Copy
"Quick one — has your insurance carrier said anything yet about the cedar shake? Because over the last 18 months we''ve had 4 out of 5 cedar-shake homeowners on this street get non-renewal notices or premium hikes north of 60%. We do conversions to Class A fire-rated — saves the policy, raises the home value. Mind if I take a look at what''s up there and pull a quick number?"','["D2D — Cedar in wildfire zone\nCopy\n\"Quick one — has your insurance carrier said anything yet about the cedar shake? Because over the last 18 months we''ve had 4 out of 5 cedar-shake homeowners on this street get non-renewal notices or premium hikes north of 60%. We do conversions to Class A fire-rated — saves the policy, raises the home value. Mind if I take a look at what''s up there and pull a quick number?\""]'::jsonb,'[]'::jsonb,158,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707005','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','TPO (Thermoplastic Polyolefin) — Commercial Flat','Lifespan
15-25 yrs
Avg Cost
$6-12/sqft installed
Best for
Strip malls, warehouses, schools, retail, small commercial
How it fails
•
Seam separation (heat-welded seams weakening over time)
•
Punctures (HVAC techs walking with tools)
•
Membrane shrinkage pulling at perimeters
•
Ponding water → premature aging
•
Inadequate or compressed insulation
The pitch angle
Property managers don''t care about membranes. They care about tenant calls. Pitch
leak elimination + tax depreciation + capex planning
. The conversation is about their P&L, not your roof.
Cold Call — TPO (PM)
Copy
"Hi [NAME] — [REP] with [COMPANY]. We do commercial TPO and EPDM work in [METRO]. Quick question, not a pitch: out of your portfolio, which 1-2 buildings have called you most about roof leaks in the last 12 months? Because that''s where we''d start with a free condition report — and you''d get something useful to budget against for next year''s capex."
D2D — TPO Strip Mall (walk-in to manager)
Copy
"Hi — looking for the property manager? I''m [REP] with [COMPANY], we just finished a TPO re-cover on [NEARBY PROPERTY] and I noticed your roof shows some classic membrane shrinkage from the parking lot. Mind if I leave a card for the PM and grab their email? I want to send a quick drone scan we''d do for free."','["Cold Call — TPO (PM)\nCopy\n\"Hi [NAME] — [REP] with [COMPANY]. We do commercial TPO and EPDM work in [METRO]. Quick question, not a pitch: out of your portfolio, which 1-2 buildings have called you most about roof leaks in the last 12 months? Because that''s where we''d start with a free condition report — and you''d get something useful to budget against for next year''s capex.\"", "D2D — TPO Strip Mall (walk-in to manager)\nCopy\n\"Hi — looking for the property manager? I''m [REP] with [COMPANY], we just finished a TPO re-cover on [NEARBY PROPERTY] and I noticed your roof shows some classic membrane shrinkage from the parking lot. Mind if I leave a card for the PM and grab their email? I want to send a quick drone scan we''d do for free.\""]'::jsonb,'[]'::jsonb,220,5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707006','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','EPDM (Rubber) — Commercial Flat','Lifespan
20-30 yrs
Avg Cost
$5-10/sqft installed
Best for
Larger flat roofs, freezer/warehouse, retrofits
How it fails
•
Seam tape failure (older glue-down systems especially)
•
Shrinkage at perimeters & penetrations
•
Hail bruising (visible on black membrane)
•
UV-driven cracking on unballasted systems
Cold Call — EPDM (Facility Director)
Copy
"Hi [NAME] — [REP] from [COMPANY]. Calling because EPDM roofs from the mid-90s to early 2000s are hitting end of life right now, and we''re seeing a wave of seam failures across [METRO]. Has anyone done a seam inspection on your roof in the last 2 years? We do them no-charge — usually we walk away with photos and a 5-page condition report you can take to your board."','["Cold Call — EPDM (Facility Director)\nCopy\n\"Hi [NAME] — [REP] from [COMPANY]. Calling because EPDM roofs from the mid-90s to early 2000s are hitting end of life right now, and we''re seeing a wave of seam failures across [METRO]. Has anyone done a seam inspection on your roof in the last 2 years? We do them no-charge — usually we walk away with photos and a 5-page condition report you can take to your board.\""]'::jsonb,'[]'::jsonb,120,6)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707007','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','PVC — Commercial Flat (Premium)','Lifespan
20-30 yrs
Avg Cost
$8-14/sqft installed
Best for
Restaurants, grease-exposed, chemical exposure, hospitals
The pitch angle
PVC''s pitch is
chemical resistance + welded seams
. If the building handles food, chemicals, or has rooftop exhaust, PVC dramatically outlasts TPO. Lead with regulatory + insurance angle: many food-service properties require PVC for grease compliance.
Cold Call — PVC (Restaurant chain GM/ops)
Copy
"Hi [NAME] — [REP] with [COMPANY]. We specialize in PVC roofing for restaurant operations. Quick question: how often is your kitchen exhaust dumping grease near the roof penetrations? Because TPO and EPDM break down where grease lands — and we replace a lot of 12-year-old TPO roofs that should have been PVC from day one. Worth 15 minutes to look at your worst location?"','["Cold Call — PVC (Restaurant chain GM/ops)\nCopy\n\"Hi [NAME] — [REP] with [COMPANY]. We specialize in PVC roofing for restaurant operations. Quick question: how often is your kitchen exhaust dumping grease near the roof penetrations? Because TPO and EPDM break down where grease lands — and we replace a lot of 12-year-old TPO roofs that should have been PVC from day one. Worth 15 minutes to look at your worst location?\""]'::jsonb,'[]'::jsonb,126,7)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707008','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','SPF (Spray Polyurethane Foam)','Lifespan
30-50 yrs with recoats
Avg Cost
$5-9/sqft installed
Best for
Recovering existing flat roofs, R-value upgrades, irregular shapes
Why SPF is the secret weapon
SPF goes
over
existing roofs without tear-off in most cases. That''s the pitch: half the cost of replacement, doubles the R-value, eliminates seams (monolithic), can be re-coated every 10-15 years for life. Most building owners have no idea this is an option.
•
Re-coat cycle: silicone or acrylic top coat at year 10-15 → another 10-15 yrs
•
Energy savings: typical 25-35% AC reduction (Cool Roof rated coatings)
•
Insurance/tax: many buildings get reclassified for energy credits
How it fails
•
Coating wear (UV) — solvable with re-coat
•
Mechanical damage (HVAC techs again)
•
Bird damage (rare, but real in some markets)
•
Improper substrate prep on install (the #1 reason SPF fails — pick a good installer)
Cold Call — SPF (the "no tear-off" angle)
Copy
"Hi [NAME] — [REP] with [COMPANY]. I''ll keep this to 30 seconds. We do spray polyurethane foam roof recovers — which means we can typically go right over your existing roof, no tear-off, and double your R-value while we''re at it. Properties our size usually see 25-30% summer AC reduction. Most owners have no idea this is even an option. Worth a 15-minute conversation about your worst-performing building?"
D2D — SPF for Industrial / Warehouse Walk-in
Copy
"Hi — is the building owner or facility manager around? I''m [REP] with [COMPANY] — we just did a spray foam recover on [NEARBY BUILDING] and it cut their summer cooling bill almost in half. I noticed your roof is the kind that''s a perfect SPF candidate — flat, asphalt or single-ply under it, would save you a tear-off. Can I leave a one-pager?"','["Cold Call — SPF (the \"no tear-off\" angle)\nCopy\n\"Hi [NAME] — [REP] with [COMPANY]. I''ll keep this to 30 seconds. We do spray polyurethane foam roof recovers — which means we can typically go right over your existing roof, no tear-off, and double your R-value while we''re at it. Properties our size usually see 25-30% summer AC reduction. Most owners have no idea this is even an option. Worth a 15-minute conversation about your worst-performing building?\"", "D2D — SPF for Industrial / Warehouse Walk-in\nCopy\n\"Hi — is the building owner or facility manager around? I''m [REP] with [COMPANY] — we just did a spray foam recover on [NEARBY BUILDING] and it cut their summer cooling bill almost in half. I noticed your roof is the kind that''s a perfect SPF candidate — flat, asphalt or single-ply under it, would save you a tear-off. Can I leave a one-pager?\""]'::jsonb,'[]'::jsonb,294,8)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707009','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','Modified Bitumen (Mod Bit)','Lifespan
10-20 yrs
Avg Cost
$4-8/sqft installed
Best for
Smaller flat commercial, older retrofits
How it fails
•
Granule loss exposing asphalt
•
Seam separation, especially torch-applied
•
Alligator cracking from UV
•
Ponding water deterioration
The pitch angle
Most mod bit owners are good candidates for an SPF recover or a TPO/PVC re-cover. Don''t sell them another mod bit unless they specifically need it. The pitch is "upgrade to a 25-year system for not much more than another 12-year band-aid."','[]'::jsonb,'[]'::jsonb,81,9)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555707010','11111111-2222-4333-8444-555555600007','11111111-2222-4333-8444-555555555501','BUR (Built-Up Roof, "Tar & Gravel")','Lifespan
15-30 yrs
Avg Cost
$5-10/sqft installed
Status
Declining install — mostly seen on older buildings
How it fails
•
Ballast displacement → membrane exposure
•
Alligatoring of bitumen
•
Blistering & ridging
•
Flashing failure at parapets
The pitch angle
BUR owners are almost always candidates for an SPF recover or single-ply re-cover. Lead with the maintenance burden: "BUR was 30-year tech in the ''70s, but maintenance costs have crept up to where most owners save money switching to TPO or SPF in years 18-22."','[]'::jsonb,'[]'::jsonb,86,10)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','🌪️ Insurance Process Mastery','Storm work is half the income in this trade — and 80% of reps leave money on the table because they don''t know the process, the timing, or the line items. Inspired by RRCA & O''Brien Contracting training. (Future build: c','sec-insurance',8)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708000','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','The Insurance Process — End to End','The whole flow, in plain English. Every rep should be able to recite this cold — homeowners ask, and the rep who explains it clearly wins the job.
Phase 1 — Pre-Claim Discovery (you, before the call)
•
Storm event verification.
Pull NOAA / HailTrace / Interactive Hail Maps. Confirm date, time, hail size, wind speed, polygon coverage. Screenshot it. This is your evidence.
•
Free inspection.
Drone + ladder. Document
everything
(see master checklist below — not just the roof).
•
Walk the homeowner through your findings.
Photos on the spot. Use adjuster language: "hail bruising," "wind uplift," "creased shingle," "compromised seal," "collateral damage."
•
Sign a contingency agreement
(or AOB where legal). This says you do the work
contingent
on insurance approval. Protects both of you.
Phase 2 — Claim Filing & Adjuster Meeting
•
Homeowner files the claim (you coach them — don''t file for them in most states; it''s their policy).
•
Insurance assigns an adjuster. Usually 3-21 day window.
•
You meet the adjuster on the roof.
Always. Never let the homeowner meet the adjuster alone.
•
Adjuster issues a scope & estimate (the "Scope of Loss" or "Estimate of Damage").
•
Carrier sends the homeowner the ACV check (initial payment minus depreciation minus deductible).
Phase 3 — Supplements, Work, Final Payment
•
You review the adjuster''s scope line-by-line.
Anything missed? File a supplement immediately.
•
Do the work. Document with photos: before, during, after, code upgrades.
•
Submit final invoice with completion certificate, photos, code-required upgrade documentation.
•
Carrier releases
depreciation recovery
(the RCV minus ACV difference) once work is complete.
•
Homeowner endorses the depreciation check. You collect.
"The reps who treat insurance like a separate job from sales make 6 figures. The reps who treat it as paperwork after a sale stay at 50k forever."
— blue collar truth','[]'::jsonb,'[]'::jsonb,307,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708001','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','Storm Response Timing — The Four Windows','Every storm creates four distinct selling windows. The opener, the urgency, and the conversation are completely different in each.
🔥 Window 1 — Immediate (0-72 hours after the storm)
•
Homeowner state:
aware, alert, anxious, watching for adjusters.
•
Competition:
brutal — every roofer in the state is on the polygons. Be first or be third.
•
Pitch angle:
"Get inspected and documented
before
your adjuster. Whoever sees the roof first sets the narrative."
•
Risk:
storm chasers from out of state, fly-by-night LLCs, predatory AOB schemes. Differentiate hard on being local + licensed + insured.
D2D — Immediate Storm Window
Copy
"Hey [NAME], [REP] with [COMPANY] — I won''t take 60 seconds. We were on your block at [TIME] yesterday and the hail polygon went right over your house. Insurance carriers are scheduling adjusters this week, and the homes that get documented
before
the adjuster shows up get a way better claim outcome. Free drone scan, 8 minutes, no obligation. Yes or no?"
🟡 Window 2 — Mid-Range (2-12 weeks post-storm)
•
Homeowner state:
moving on. "I checked, didn''t see anything. I''m fine." Wrong, but reasonable.
•
Pitch angle:
"Hail damage doesn''t show as a leak for 6-18 months. By then the claim window has tightened and the damage is harder to prove. Now is the window."
•
Approach:
reference the specific storm date. Show them the hail polygon over their address. Most haven''t seen this evidence.
D2D — Mid-Range
Copy
"Hi [NAME] — quick question. Did anyone ever look at your roof after the [STORM DATE] hail event? Because most people on this block didn''t get inspected and they''re sitting on damage they don''t know about. The trap is, hail damage doesn''t leak right away — it ages the shingles and shows up as a leak 12-18 months later, after the claim window closes. 8 minutes with the drone tells us if there''s anything to even file."
🟠 Window 3 — Aged Claim (3-12+ months post-storm)
•
Homeowner state:
forgot about the storm. "We had a storm? When?"
•
Pitch angle:
revive the memory with specifics. Date, time, hail size, polygon. Then show that most carriers have a 1-2 year filing window from date of loss — but it tightens fast.
•
Approach:
bring a printed weather report. Sounds extreme; it works.
D2D — Aged Claim
Copy
"Mr./Mrs. [NAME] — bear with me, this''ll sound weird. On [DATE] — about [#] months back — there was a hail event that put 1.25" stones over this neighborhood for about 15 minutes. Most homeowners forgot. Here''s the National Weather Service report [hand them a printout]. Most carriers will still pay damage from that event for another [#] months, but the window closes. We''re knocking the affected streets one more time. Worth 8 minutes with the drone to see if you''ve got anything?"
🟢 Window 4 — Outskirts / Borderline Hail (the underrated channel)
•
State:
homes on the edge of a storm polygon, or hit by smaller hail (½" - ¾"). Most reps skip these streets because the damage is harder to see.
•
Reality:
smaller hail still creates
functional damage
— granule loss, mat exposure, shortened roof life. Many carriers pay if you document properly.
•
Pitch angle:
"You were on the edge of the storm. The bigger streets got hammered and got fast service. Your block got less hail, so you got skipped. But you might still qualify — and the rep who documents you carefully gets you paid."
•
This is your year-round work after a storm cycle.
Lower competition, slightly lower close rate, but doors stay open longer than the hot zones.
D2D — Outskirts / Borderline
Copy
"Hi [NAME] — your block was on the edge of the [DATE] storm, the part most roofers skip because the hail was smaller. But smaller hail still beats up shingles — just less visibly. We do a careful drone inspection looking specifically for granule loss, mat exposure, and the borderline impacts that bigger crews miss. Half the homes I scan on these edge streets still qualify for an insurance look. Free, 8 minutes, no obligation."','["D2D — Immediate Storm Window\nCopy\n\"Hey [NAME], [REP] with [COMPANY] — I won''t take 60 seconds. We were on your block at [TIME] yesterday and the hail polygon went right over your house. Insurance carriers are scheduling adjusters this week, and the homes that get documented\nbefore\nthe adjuster shows up get a way better claim outcome. Free drone scan, 8 minutes, no obligation. Yes or no?\"", "D2D — Mid-Range\nCopy\n\"Hi [NAME] — quick question. Did anyone ever look at your roof after the [STORM DATE] hail event? Because most people on this block didn''t get inspected and they''re sitting on damage they don''t know about. The trap is, hail damage doesn''t leak right away — it ages the shingles and shows up as a leak 12-18 months later, after the claim window closes. 8 minutes with the drone tells us if there''s anything to even file.\"", "D2D — Aged Claim\nCopy\n\"Mr./Mrs. [NAME] — bear with me, this''ll sound weird. On [DATE] — about [#] months back — there was a hail event that put 1.25\" stones over this neighborhood for about 15 minutes. Most homeowners forgot. Here''s the National Weather Service report [hand them a printout]. Most carriers will still pay damage from that event for another [#] months, but the window closes. We''re knocking the affected streets one more time. Worth 8 minutes with the drone to see if you''ve got anything?\"", "D2D — Outskirts / Borderline\nCopy\n\"Hi [NAME] — your block was on the edge of the [DATE] storm, the part most roofers skip because the hail was smaller. But smaller hail still beats up shingles — just less visibly. We do a careful drone inspection looking specifically for granule loss, mat exposure, and the borderline impacts that bigger crews miss. Half the homes I scan on these edge streets still qualify for an insurance look. Free, 8 minutes, no obligation.\""]'::jsonb,'[]'::jsonb,687,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708002','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','The Master Damage Documentation Checklist','The roof is the entry point — but the rest of the property is where the supplement money lives. Walk the entire exterior, every time. If you only document the roof, you''re working at half rate.
🏠 The Roof Itself
•
Hail bruising / impact marks (chalk-circle each one for photo)
•
Wind damage: creased shingles, lifted tabs, missing shingles
•
Granule loss in valleys, gutters, downspout splash blocks
•
Mat / fiberglass exposure under granule loss
•
Compromised seal strips (lift test)
•
Flashing damage: step, counter, valley, drip edge, apron
•
Pipe boots & collars (cracked, lifted)
•
Ridge cap shingles (frequently overlooked)
•
Hip & valley damage
•
Underlayment exposure, decking visible
•
Skylights (frames, flashing, glass)
•
Sun tunnels / solar tubes
•
Turtle vents, ridge vent, box vents, gable vents
•
Chimney chase pan, shroud, cap, cricket flashing
•
Solar panel tempered glass (look closely)
•
Satellite dish brackets (DnR opportunity)
🪵 Gutters, Fascia, Soffit, Wraps
•
Gutter dents, dings, splatter marks (hail "splash pattern")
•
Gutter pitch / detachment
•
Downspouts: dents, detachment, splash block
•
Fascia: wood rot under aluminum, dents in aluminum wrap
•
Soffit panels: dents, holes, ventilation soffit damage
•
Gutter guards / leaf filter (often hail-pitted)
•
Fascia wrap / aluminum trim
— frequently missed line item
•
Frieze board
— the trim board where siding meets soffit
🧱 Siding & Exterior Walls
•
Vinyl siding: cracks, chips, holes, fading from impact
•
Hardiplank / fiber cement: chips, breaks, paint loss at impacts
•
Stucco: pitting, cracking, chunks missing
•
Brick & stone: rare but check for chips on softer brick
•
Wood siding: dents, paint loss at impact, splintering
•
Caulking damage at seams
•
Paint chipping at impact zones (separate paint line item)
🪟 Windows, Doors, & Wraps (the easy-to-miss money)
•
Window screens
— always paid, check every one. Hail-pitted screens come out 100% of the time.
•
Window glass: cracking, pitting (uncommon but check tempered/casement)
•
Window wraps / aluminum trim
— the aluminum surround on most newer windows. Dents = full replacement on that wrap.
•
Window sills (wood): paint loss, denting, rot exposed
•
Window frames: vinyl cracking, aluminum denting
•
Storm windows / storm doors
•
Bay window roofs (mini-roof above bay — frequently missed)
•
Door wraps / aluminum trim
— same as window wraps, around exterior doors
•
Garage doors —
this is a $1,500-$4,000 line item people forget
. Even small dents = panel replacement.
•
Door screens, screen doors
•
Door glass: storm doors, sidelights, transom windows
•
Door hardware: kickplate damage, dented handles
❄️ HVAC, Electrical, & Utility
•
AC condenser fins
— bent fins from hail. The fix is "condenser comb" — a labor line item, ~$150-300 per unit.
Always check, almost always paid.
•
AC unit covers / top grilles (dented or cracked)
•
Mini-split outdoor units
•
Electrical meter / meter base wrap
•
Electrical service mast (if bent from wind)
•
Light fixtures: broken globes, dented housings, broken bulbs
•
Doorbell housing, intercom box
•
Security camera housings
•
Pool pump housing
🌳 Outdoor Structures & Items
•
Detached garage / shed roof & siding
•
Pergola / gazebo roofs
•
Outdoor kitchen tops, grill covers
•
Mailbox & mailbox post
•
House numbers, decorative gable items
•
Pool screen enclosure / lanai (huge in FL — entire screen + frame replaced)
•
Trampoline (if visible event damage)
•
Playhouse / swing set roofs
•
RV cover / boat cover (if structural)
•
Wood fence — paint and stain.
If the storm peppered the fence enough to chip paint or pit the stain, that''s a re-stain line item:
"pressure wash & restain wood fence."
Frequently missed.
•
Wood deck — re-stain
if the storm peppered the deck surface and stripped finish
📋 Add-On / Code-Required / Overhead
•
Ice & water shield
at eaves, valleys, penetrations (code in most cold-climate jurisdictions)
•
Drip edge
(code in most states post-2012; if not present, add as code upgrade)
•
Synthetic underlayment upgrade
(vs felt)
•
Deck re-nailing pattern (6-nail in high-wind, code in many jurisdictions)
•
Step flashing replacement (cannot reuse old step flashing — code in most jurisdictions)
•
Permit fees (line item — varies by city)
•
Dumpster & debris haul-off
•
Detach & Reset (DnR)
: solar panels, satellite dishes, lightning rods, antennas, weather stations
•
General Contractor Overhead & Profit (O&P)
: 10% / 10% = 20% on claims involving 3+ trades. Many adjusters omit this — supplement it.
•
Sales tax on materials (state-dependent)','[]'::jsonb,'[]'::jsonb,764,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708003','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','Money Makers — Line Items 80% of Reps Miss','Memorize these. Every one of them is a real, common, payable line item that the average rep overlooks. This list is the difference between a $14k job and a $22k job on the same roof.
Condenser Comb
Hail-bent AC fins. ~$150-300/unit. Universal.
Window Screens
Pitted from hail. ~$35-75 each. Almost always paid.
Window & Door Wraps
Aluminum trim surrounds. ~$80-250 per opening. Dents = replace.
Garage Door Panels
Small dents = panel replacement. $1.5k-4k.
Fascia Wrap / Frieze Board
Dented aluminum or stained wood trim along eaves.
Pressure Wash + Restain Fence
Peppered fence loses stain — restain is line-item.
Pressure Wash + Restain Deck
Same logic if deck took impacts.
Pool Screen Enclosure
FL/TX — entire panel + frame, huge ticket.
Bay Window Roof
Mini-roof above bay window — own line.
Chimney Chase Pan / Shroud / Cap
Three separate items. Each can dent.
Skylight Frames & Flashing
Even if glass is fine, frame/flash often damaged.
Light Fixture Globes
Hail-smashed plastic or glass exterior fixtures.
Mailbox & Post
Wood or metal — both qualify.
Detached Shed / Garage Roof
Separate structure, separate scope.
Ridge Vent / Box Vents / Turtle Vents
Plastic ones crack from hail. Per-vent replacement.
Pipe Boots & Collars
UV-cracked or hail-cracked. ~$40-80 each.
Solar Panel Tempered Glass
Stress fractures show under angled light. Huge claim.
Satellite/Antenna DnR
Detach & reset is a labor line.
Step Flashing
Cannot reuse — code requires new. Often skipped.
Drip Edge
Code in most states post-2012. If absent, add as code upgrade.
Ice & Water Shield
Code upgrade in cold climates — separate line.
Permit Fees
Always a line item. Pull from your city''s fee schedule.
Dumpster & Haul-Off
Often separate line; some adjusters bundle.
GC Overhead & Profit
20% (10/10) on 3+ trade claims. Supplement if missing.
Walk every claim with this list in hand.
Print it. Laminate it. Clip it to the clipboard. Adjusters will never volunteer these — you have to bring them up.','[]'::jsonb,'[]'::jsonb,327,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708004','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','The Adjuster Meeting Playbook','The 90-minute window when the adjuster is on the property is the most important meeting in the entire claim. Show up like a pro and you set the scope; show up unprepared and the homeowner gets a partial claim.
What to Bring
•
Ladder (yours, not theirs)
•
Drone (charged, SD card cleared)
•
Chalk (for circling hail hits — adjusters appreciate the courtesy and it makes photos pop)
•
Tape measure / Bluetooth distance meter
•
Printed copy of your scope and your own Xactimate-style estimate (or the globalcontractor.app printout)
•
Printed storm verification (NOAA / HailTrace screenshot with date, hail size, polygon)
•
Camera or phone for documentation (your photos, not theirs)
•
Master Damage Documentation Checklist (the one above, printed)
•
Business cards + your contractor license number visible
The Meeting — Pre-Roof
•
Shake the adjuster''s hand. Use their name. Be warm — they have 5 of these today.
•
Confirm the storm event with them. "We''re looking at the [DATE] event, 1.5" hail per NOAA, polygon ran from [STREET] to [STREET]." Establishes you''ve done your homework.
•
Walk them around the exterior
before
the roof. Point at the gutter splash, the window screens, the fascia. Plant the seed: "we''ll want to look at these on the way down too."
The Meeting — On the Roof
•
You go up first. Adjuster follows. Don''t crowd them.
•
Use the test square method: a 10'' × 10'' chalk box on the worst slope. Count visible impacts inside the square. Most carriers require 6-8 hits per square (varies — know your carrier).
•
Chalk-circle every hit you find. Take photos.
•
If the adjuster is missing things:
"Did you catch the soft hit on the south slope ridge cap?"
Don''t argue — point.
•
Show wind uplift: lift a tab gently. If the seal strip is broken, photograph.
•
Document collateral: gutters, vents, pipe boots, skylights.
The Meeting — Post-Roof Walk
•
Walk the exterior again with checklist in hand. Window screens, window wraps, door wraps, garage door, AC condenser fins, fascia, fence, etc.
•
Don''t argue functional vs cosmetic on-site. If they call something cosmetic and you disagree, document it and supplement later in writing.
•
Get their estimate number, expected turnaround, and direct contact info.
•
Thank them. Genuine handshake. They''ll send you a Christmas card next year.
Red Flags From the Adjuster
•
"I''m only writing a few squares for repair." → Push back politely, request full slope replacement if matching shingles are no longer available.
•
"I don''t see enough hits." → Request a re-inspection from a senior adjuster.
•
"That''s cosmetic, not functional." → Document, supplement in writing with manufacturer specs & ASTM 4869 references.
•
"You can''t be here." → Some adjusters try this. You''re a representative of the homeowner. Be polite, stand your ground.','[]'::jsonb,'[]'::jsonb,473,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708005','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','ACV vs RCV — The Insurance Conversation with the Homeowner','The single most common reason a deal dies in the kitchen is the homeowner doesn''t understand how insurance pays. Explain it cleanly and you remove the biggest objection.
The 60-Second Explanation
"Your policy is one of two types: ACV or RCV. ACV — actual cash value — means they pay you what the roof was worth
at the moment of the storm
, factoring in depreciation. So a 15-year-old roof with 10 more years of life might be valued at $7k even if a new one costs $14k. You''re on the hook for the difference.
RCV — replacement cost value — pays you the actual cost to replace the roof with a new one, minus your deductible. They send you the depreciation as a held-back amount, and they release it once we finish the work. Most policies today are RCV. Let''s pull your declarations page and check."
What the Homeowner Pays Out of Pocket
•
The deductible.
Always. That''s their share, set by their policy. (Some states have higher hail/wind deductibles — 1-2% of dwelling value.)
•
Any upgrades they choose
beyond what insurance pays for. (e.g., they want the impact-resistant shingle but insurance only paid for standard arch.)
•
Nothing else.
If we wrote the scope right and supplemented properly, the deductible is their entire out-of-pocket.
Two Phrases to Never Use
•
❌
"We''ll cover your deductible."
Illegal in most states. Insurance fraud. Career-ending. Don''t do it. Don''t imply it.
•
❌
"This is a free roof."
It''s not free — they paid premiums for decades. Frame it correctly: "Your insurance is doing what you paid them to do."
The Homeowner Script
Insurance Walk-Through Script
Copy
"Here''s exactly what''s going to happen. Today we sign a contingency agreement — that means we do the work
only
if your insurance approves it. Tomorrow you call your carrier and file the claim — I''ll text you the script. Within a few weeks they''ll send an adjuster. I''ll be here on the roof with him.
Once they issue the scope and the check, you''ll get an ACV check minus your deductible. That money goes into your account. We schedule the work. We do the roof and everything else we documented. When it''s done, I submit a completion package and the insurance company releases the depreciation — the second check.
Your only out-of-pocket is your deductible. That''s it. Sound clear?"','["\"Your policy is one of two types: ACV or RCV. ACV — actual cash value — means they pay you what the roof was worth\nat the moment of the storm\n, factoring in depreciation. So a 15-year-old roof with 10 more years of life might be valued at $7k even if a new one costs $14k. You''re on the hook for the difference.\nRCV — replacement cost value — pays you the actual cost to replace the roof with a new one, minus your deductible. They send you the depreciation as a held-back amount, and they release it once we finish the work. Most policies today are RCV. Let''s pull your declarations page and check.\"", "Insurance Walk-Through Script\nCopy\n\"Here''s exactly what''s going to happen. Today we sign a contingency agreement — that means we do the work\nonly\nif your insurance approves it. Tomorrow you call your carrier and file the claim — I''ll text you the script. Within a few weeks they''ll send an adjuster. I''ll be here on the roof with him.\nOnce they issue the scope and the check, you''ll get an ACV check minus your deductible. That money goes into your account. We schedule the work. We do the roof and everything else we documented. When it''s done, I submit a completion package and the insurance company releases the depreciation — the second check.\nYour only out-of-pocket is your deductible. That''s it. Sound clear?\""]'::jsonb,'[]'::jsonb,397,5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708006','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','Supplements & Re-Inspections — The Second Payday','If you only collect on the initial scope, you''re working at 60-70% of full payout. Most claims supplement 1-3 times before the final check clears. Treat supplements as standard procedure, not an exception.
When to Supplement
•
Adjuster missed a line item from your master checklist
•
You discovered additional damage during tear-off (rotted decking, hidden underlayment damage)
•
Code upgrades were not included (ice & water shield, drip edge, deck re-nail)
•
Detach & reset items were missed (solar panels, satellite, lightning rod)
•
Overhead & profit (O&P) wasn''t applied to a 3+ trade claim
•
Material prices increased between scope and completion
•
Matching: full slope or full roof required because shingle no longer manufactured (line of sight rule in many states)
How to File a Supplement
•
Document the additional item with photos, measurement, and manufacturer/code reference
•
Write a clear, professional letter to the adjuster (or their supervisor if no response)
•
Attach: photos, line-item description, Xactimate-style pricing, code reference if applicable
•
Send via email AND certified mail. Keep proof of delivery.
•
Follow up at day 7 if no response. Day 14, escalate to supervisor. Day 21, file a re-inspection request.
Re-Inspection Strategy
If an adjuster denies functional damage you believe is real, request a re-inspection — usually a senior adjuster comes out. Bring everything you''d bring to the first meeting,
plus
the original scope with your annotations and supplement letter. Be cordial. Senior adjusters often correct first-pass mistakes if you give them an easy out.
When to Bring in a Public Adjuster or Attorney
If the carrier is denying a clearly valid claim, refusing to engage on supplements, or low-balling severely (more than 30% under fair scope), refer the homeowner to a licensed public adjuster (PA) or insurance attorney.
Do not
represent the homeowner yourself unless you are licensed in your state. Boundaries matter — and adjusters notice when contractors play attorney.','[]'::jsonb,'[]'::jsonb,319,6)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708007','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','The Estimate — Xactimate Basics & globalcontractor.app','Insurance carriers run on Xactimate. You don''t have to write Xactimate to compete, but you need to
read
it cold, and your own estimate needs to mirror its structure so you can argue line-by-line.
Xactimate Cheat Sheet
•
Codes:
every line item has a code. RFG (roofing), GUT (gutters), SDG (siding), WDW (windows), DOR (doors), HVC (HVAC). Memorize the most-used codes.
•
Pricing:
regional, updated monthly. Two homes 10 miles apart can have different unit costs.
•
Activity vs material:
most lines are split — labor + material. Some lines are "remove & replace," some are "remove only" + new install.
•
Waste factor:
standard 10-15% on roofing materials. More for complex roofs (lots of valleys, hips).
•
Overhead & Profit (O&P):
10% overhead + 10% profit = 20%. Standard on claims involving 3+ trades.
•
Sales tax:
applied to materials only, state-dependent.
•
Depreciation:
applied to materials based on age & condition; recoverable on RCV policies upon completion.
The Estimate Workflow (Today)
•
Measure the roof (drone software, EagleView, GAF QuickMeasure, or hand)
•
Walk the exterior with the master checklist
•
Photograph everything
•
Build line-item estimate matching adjuster scope structure
•
Print + review with homeowner + present to adjuster
🔗 Future Integration — globalcontractor.app
Roadmap note for this app: connect
globalcontractor.app
as the estimating engine — Xactimate-style line-item pricing, regional, mobile-friendly, and dramatically easier than full Xactimate. The plan is for reps to:
•
Pull the documented damage checklist directly from this guide into a globalcontractor.app estimate
•
Build the scope in minutes on a phone or tablet
•
Match adjuster Xactimate output line-for-line for clean supplements
•
Email the estimate to the homeowner & adjuster directly from the app
Until that integration is live, build the estimate in globalcontractor.app separately and treat this guide as the field-side reference. Once connected, the two will be one workflow.','[]'::jsonb,'[]'::jsonb,311,7)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555708008','11111111-2222-4333-8444-555555600008','11111111-2222-4333-8444-555555555501','Storm-Specific Homeowner Scripts','"Should I file a claim?" — the homeowner''s #1 question
Copy
"Here''s how I''d think about it. We document the damage first. If what we find is below your deductible, you don''t file — no point. If what we find is well above your deductible, you absolutely file — that''s what your policy is for. The drone scan tells us which one it is. No claim filed until we know."
"Will my rates go up?" — the second-most-common question
Copy
"Honest answer: not for catastrophic weather claims in most states. Hail and wind are ''act of God'' events — carriers can''t single you out for filing one. Your
area''s
rates may go up across the board because of the storm, but they''re going up whether you file or not. The question is whether you want to pay for the roof you already paid for in premiums."
"What if my claim gets denied?"
Copy
"Two paths if that happens. One — we request a re-inspection from a senior adjuster, and 40% of the time that flips the decision. Two — if it''s still denied and we strongly disagree, we can refer you to a licensed public adjuster who works for you, not the insurance company. Worst case, you''ve lost nothing — you didn''t pay your deductible because no work happened."
"I don''t want to deal with the insurance company"
Copy
"You don''t have to deal with them much at all. You file the claim — one phone call, I''ll text you the script. After that, I''m on the roof with the adjuster, I review their scope, I file any supplements, I handle the paperwork. You sign a couple of things and cash a couple of checks. Most of my homeowners spend less than 90 total minutes on the whole process."
"My neighbor says insurance is going to drop me"
Copy
"Your neighbor may be repeating something they heard. The reality: carriers can non-renew for excessive small claims or multiple at-fault claims. A catastrophic weather claim almost never triggers non-renewal in [STATE]. If you''re worried, let''s call your agent together right now and ask before we file. Three-minute call, ends the worry."
Filing the claim — what to tell the homeowner to say on the call
Copy
Coach the homeowner to say (and only this):
"Hi, I''d like to file a claim. I had storm damage from the [DATE] hail/wind event. I had a roofing contractor do an inspection and they found [hail damage / wind damage / both]. I''d like to schedule an adjuster to come out."
Things to NOT say:
- Don''t speculate on cost
- Don''t say "my roof is destroyed"
- Don''t say "the contractor said it''s totaled"
- Don''t volunteer information about previous claims
- Don''t agree to language like "minor damage" or "small claim"
Get the claim number. Write it down. Text it to me.','["\"Should I file a claim?\" — the homeowner''s #1 question\nCopy\n\"Here''s how I''d think about it. We document the damage first. If what we find is below your deductible, you don''t file — no point. If what we find is well above your deductible, you absolutely file — that''s what your policy is for. The drone scan tells us which one it is. No claim filed until we know.\"", "\"Will my rates go up?\" — the second-most-common question\nCopy\n\"Honest answer: not for catastrophic weather claims in most states. Hail and wind are ''act of God'' events — carriers can''t single you out for filing one. Your\narea''s\nrates may go up across the board because of the storm, but they''re going up whether you file or not. The question is whether you want to pay for the roof you already paid for in premiums.\"", "\"What if my claim gets denied?\"\nCopy\n\"Two paths if that happens. One — we request a re-inspection from a senior adjuster, and 40% of the time that flips the decision. Two — if it''s still denied and we strongly disagree, we can refer you to a licensed public adjuster who works for you, not the insurance company. Worst case, you''ve lost nothing — you didn''t pay your deductible because no work happened.\"", "\"I don''t want to deal with the insurance company\"\nCopy\n\"You don''t have to deal with them much at all. You file the claim — one phone call, I''ll text you the script. After that, I''m on the roof with the adjuster, I review their scope, I file any supplements, I handle the paperwork. You sign a couple of things and cash a couple of checks. Most of my homeowners spend less than 90 total minutes on the whole process.\"", "\"My neighbor says insurance is going to drop me\"\nCopy\n\"Your neighbor may be repeating something they heard. The reality: carriers can non-renew for excessive small claims or multiple at-fault claims. A catastrophic weather claim almost never triggers non-renewal in [STATE]. If you''re worried, let''s call your agent together right now and ask before we file. Three-minute call, ends the worry.\"", "Filing the claim — what to tell the homeowner to say on the call\nCopy\nCoach the homeowner to say (and only this):\n\"Hi, I''d like to file a claim. I had storm damage from the [DATE] hail/wind event. I had a roofing contractor do an inspection and they found [hail damage / wind damage / both]. I''d like to schedule an adjuster to come out.\"\nThings to NOT say:\n- Don''t speculate on cost\n- Don''t say \"my roof is destroyed\"\n- Don''t say \"the contractor said it''s totaled\"\n- Don''t volunteer information about previous claims\n- Don''t agree to language like \"minor damage\" or \"small claim\"\nGet the claim number. Write it down. Text it to me."]'::jsonb,'[]'::jsonb,479,8)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','🛡️ Rebuttal Arsenal','25 objections, multiple responses each. Don''t argue — reframe. Loop, never push.','sec-rebuttals',9)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709000','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I''m not interested."','95% of "not interested"s are reflex. Don''t take it personally; reframe and stay.
"Totally fair — you don''t even know what I''d be interesting
about
yet. Real quick — when''s the last time anyone actually looked at your roof? Because what we''re seeing from the street is something insurance pays for, not you. If we find nothing, you''ve lost nothing."
"You shouldn''t be — most of the homeowners we end up working with weren''t interested at first either. Then they saw the drone photos. 8 minutes."
"Got it — I''ll make it easy. Yes or no: do you want me to send you the drone photos we already took, or no?"','["\"Totally fair — you don''t even know what I''d be interesting\nabout\nyet. Real quick — when''s the last time anyone actually looked at your roof? Because what we''re seeing from the street is something insurance pays for, not you. If we find nothing, you''ve lost nothing.\"", "\"You shouldn''t be — most of the homeowners we end up working with weren''t interested at first either. Then they saw the drone photos. 8 minutes.\"", "\"Got it — I''ll make it easy. Yes or no: do you want me to send you the drone photos we already took, or no?\""]'::jsonb,'[]'::jsonb,111,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709001','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"Just send me information / Send me a quote."','"Happy to — but here''s the trap: any quote without me actually seeing the roof is fiction, and you''ll just have to throw it out. Give me 15 minutes on the roof and I''ll send you a real number plus drone photos. Thursday or Saturday work better?"
"I''d love to, but the truth is generic info isn''t useful — your roof is different from your neighbor''s. Let me put eyes on it for 15 minutes and you''ll get a report that''s actually about
your
house."','["\"Happy to — but here''s the trap: any quote without me actually seeing the roof is fiction, and you''ll just have to throw it out. Give me 15 minutes on the roof and I''ll send you a real number plus drone photos. Thursday or Saturday work better?\"", "\"I''d love to, but the truth is generic info isn''t useful — your roof is different from your neighbor''s. Let me put eyes on it for 15 minutes and you''ll get a report that''s actually about\nyour\nhouse.\""]'::jsonb,'[]'::jsonb,85,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709002','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I don''t have the money."','"That''s exactly why we should look at it now — because if there''s hail or wind damage, insurance pays, not you. We''ve literally never had a homeowner pay out of pocket for damage that qualified. Worth 8 minutes to find out if you''re sitting on a free replacement?"
"Got it. Two paths: one, if there''s storm damage, this is an insurance project, not a money project. Two, if it''s just age, we have financing as low as $89/month with $0 down. Either path, the inspection is free. Thursday or Saturday?"','["\"That''s exactly why we should look at it now — because if there''s hail or wind damage, insurance pays, not you. We''ve literally never had a homeowner pay out of pocket for damage that qualified. Worth 8 minutes to find out if you''re sitting on a free replacement?\"", "\"Got it. Two paths: one, if there''s storm damage, this is an insurance project, not a money project. Two, if it''s just age, we have financing as low as $89/month with $0 down. Either path, the inspection is free. Thursday or Saturday?\""]'::jsonb,'[]'::jsonb,90,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709003','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I need to think about it."','Edwards'' Law: "I need to think about it" is never the real objection. There''s an unresolved concern they''re hiding. Find it.
"Fair enough — folks usually want to think about three things: the price, the timing, or the company itself. Which of those is the one sitting on you tonight?"
"Of course. Real quick — is it the price, the timing, or the people? Because if it''s price, we have options. If it''s timing, we have options. If it''s the company, that''s the most important thing to talk through before I leave."
(Edwards'' Lost Sale variant):
"Totally — and I''m clearly not going to earn your business tonight, that''s okay. For my own training, what''s the one thing I could''ve done differently?" → 30% of the time the real objection drops here. Now handle it.','["\"Fair enough — folks usually want to think about three things: the price, the timing, or the company itself. Which of those is the one sitting on you tonight?\"", "\"Of course. Real quick — is it the price, the timing, or the people? Because if it''s price, we have options. If it''s timing, we have options. If it''s the company, that''s the most important thing to talk through before I leave.\"", "(Edwards'' Lost Sale variant):\n\"Totally — and I''m clearly not going to earn your business tonight, that''s okay. For my own training, what''s the one thing I could''ve done differently?\" → 30% of the time the real objection drops here. Now handle it."]'::jsonb,'[]'::jsonb,135,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709004','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I need to talk to my spouse."','"Of course. Quick — what time tomorrow or the next day are you both home? I''d rather present once to both of you than three times to one of you. Tomorrow at 6 or Wednesday at 7?"
"Smart — never sign anything without your partner. Let me ask: between you and your spouse, who would have the biggest concern about us doing this? That''s the question I want to be ready to answer when you both sit down."','["\"Of course. Quick — what time tomorrow or the next day are you both home? I''d rather present once to both of you than three times to one of you. Tomorrow at 6 or Wednesday at 7?\"", "\"Smart — never sign anything without your partner. Let me ask: between you and your spouse, who would have the biggest concern about us doing this? That''s the question I want to be ready to answer when you both sit down.\""]'::jsonb,'[]'::jsonb,78,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709005','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"Call me back in 6 months / next year."','"Happy to — out of curiosity, what changes in 6 months? Because if it''s budget, we have $0-down financing now. If it''s storm damage, insurance gets harder, not easier. If it''s just timing, I get it — and I''ll put it on my calendar."
"I''ll absolutely follow up. Quick favor though — let me drone-scan it now so the file I bring back in 6 months actually has data, not guesses. Costs you nothing."','["\"Happy to — out of curiosity, what changes in 6 months? Because if it''s budget, we have $0-down financing now. If it''s storm damage, insurance gets harder, not easier. If it''s just timing, I get it — and I''ll put it on my calendar.\"", "\"I''ll absolutely follow up. Quick favor though — let me drone-scan it now so the file I bring back in 6 months actually has data, not guesses. Costs you nothing.\""]'::jsonb,'[]'::jsonb,74,5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709006','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I already have someone / a buddy."','"Great — most homeowners who hire us already had someone. All I''m offering is a free second opinion with drone photos. Take it to your guy and ask if he agrees with what we found. Either we''re right and he confirms, or we''re wrong and your guy looks like a hero. You win both ways."
"That''s smart — relationships matter. The only thing I''d say is: when''s the last time your guy did a no-charge inspection with current drone photos? Because that''s all we''re offering. Same playbook your guy probably runs."','["\"Great — most homeowners who hire us already had someone. All I''m offering is a free second opinion with drone photos. Take it to your guy and ask if he agrees with what we found. Either we''re right and he confirms, or we''re wrong and your guy looks like a hero. You win both ways.\"", "\"That''s smart — relationships matter. The only thing I''d say is: when''s the last time your guy did a no-charge inspection with current drone photos? Because that''s all we''re offering. Same playbook your guy probably runs.\""]'::jsonb,'[]'::jsonb,91,6)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709007','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"Your price is too high."','Cardone: "There''s no such thing as price — only payments and value." Reframe.
"I get it. Let me ask — too high compared to
what
? Because if you got a bid for $X less, I want to see what''s in it. Most of the time, the difference is decking, underlayment, or warranty — and that''s where roofs leak."
"Compared to nothing, every roof is too high. Compared to the bill when this thing fails in a storm, we''re a bargain. Let me show you the line items vs the cheap bid — I''ll bet I find the $3k of stuff they''re skipping."
"It''s a real number — and I won''t apologize for it. What I will do is show you why. If after I walk you through it, you still think it''s too high, we shake hands and I leave. Fair?"','["\"I get it. Let me ask — too high compared to\nwhat\n? Because if you got a bid for $X less, I want to see what''s in it. Most of the time, the difference is decking, underlayment, or warranty — and that''s where roofs leak.\"", "\"Compared to nothing, every roof is too high. Compared to the bill when this thing fails in a storm, we''re a bargain. Let me show you the line items vs the cheap bid — I''ll bet I find the $3k of stuff they''re skipping.\"", "\"It''s a real number — and I won''t apologize for it. What I will do is show you why. If after I walk you through it, you still think it''s too high, we shake hands and I leave. Fair?\""]'::jsonb,'[]'::jsonb,142,7)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709008','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I just need a repair, not a replacement."','"That''s possible — and if that''s all you need, I''ll tell you that. But let me ask: are you OK spending $1,800 on a repair if the roof has 18 months left? Because that math doesn''t work. Let me drone-scan it, give you a real life-expectancy number, and then you''ll know whether to repair or replace."','["\"That''s possible — and if that''s all you need, I''ll tell you that. But let me ask: are you OK spending $1,800 on a repair if the roof has 18 months left? Because that math doesn''t work. Let me drone-scan it, give you a real life-expectancy number, and then you''ll know whether to repair or replace.\""]'::jsonb,'[]'::jsonb,56,8)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709009','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"Take me off your list."','Comply immediately. Don''t argue. Don''t try to "save" the call.
"Absolutely — done. Sorry for the bother. Have a great rest of your day."
Log it. Move on. The fastest way to lose a license and a reputation is to harass a DNC.','["\"Absolutely — done. Sorry for the bother. Have a great rest of your day.\""]'::jsonb,'[]'::jsonb,43,9)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709010','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"How did you get my number?"','"Fair question — we use public records and lead lists scrubbed against the DNC. If you''d rather not hear from us, I''ll take you off right now. But while I''ve got you for 30 seconds — was there a reason for the question, or just curious?"','["\"Fair question — we use public records and lead lists scrubbed against the DNC. If you''d rather not hear from us, I''ll take you off right now. But while I''ve got you for 30 seconds — was there a reason for the question, or just curious?\""]'::jsonb,'[]'::jsonb,46,10)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709011','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I don''t take cold calls."','"Most people don''t — and that''s exactly why I make a point of being useful in 30 seconds or off the line. So here''s 30 seconds: [hook]. Worth one more minute, or do you want me off the call?"','["\"Most people don''t — and that''s exactly why I make a point of being useful in 30 seconds or off the line. So here''s 30 seconds: [hook]. Worth one more minute, or do you want me off the call?\""]'::jsonb,'[]'::jsonb,39,11)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709012','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"We''re under contract with another vendor."','"Smart — and I''m not trying to break a contract. What I am asking is: when does it come up for renewal, and are you happy enough with the current vendor that you wouldn''t even take a second bid? Because most facility directors I work with want a backup vendor on speed dial for the things their main vendor won''t touch."','["\"Smart — and I''m not trying to break a contract. What I am asking is: when does it come up for renewal, and are you happy enough with the current vendor that you wouldn''t even take a second bid? Because most facility directors I work with want a backup vendor on speed dial for the things their main vendor won''t touch.\""]'::jsonb,'[]'::jsonb,61,12)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709013','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I''m in a meeting / busy right now."','"Totally — I''ll let you go. What''s a better time later today or tomorrow? Morning or afternoon?"
"Got it. 30 seconds: [drop the hook]. If that''s interesting, I''ll call you tomorrow at a real time. Sound fair?"','["\"Totally — I''ll let you go. What''s a better time later today or tomorrow? Morning or afternoon?\"", "\"Got it. 30 seconds: [drop the hook]. If that''s interesting, I''ll call you tomorrow at a real time. Sound fair?\""]'::jsonb,'[]'::jsonb,37,13)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709014','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"Just email me."','"Will do. While I have you — give me 60 seconds to know what to actually put
in
the email so I''m not wasting your inbox. Two questions: [Q1] and [Q2]."','["\"Will do. While I have you — give me 60 seconds to know what to actually put\nin\nthe email so I''m not wasting your inbox. Two questions: [Q1] and [Q2].\""]'::jsonb,'[]'::jsonb,31,14)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709015','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"Not now."','"Got it. ''Not now'' means there''s a ''when.'' Is the ''when'' next month, next quarter, or just ''someday''? Because if it''s someday, I''m not gonna waste your time. If it''s next quarter, I''d rather schedule the look now so we beat the rainy season."','["\"Got it. ''Not now'' means there''s a ''when.'' Is the ''when'' next month, next quarter, or just ''someday''? Because if it''s someday, I''m not gonna waste your time. If it''s next quarter, I''d rather schedule the look now so we beat the rainy season.\""]'::jsonb,'[]'::jsonb,44,15)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709016','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I had a bad experience with roofers."','"I''m sorry — and unfortunately I hear that a lot. Honestly the bad operators in our industry are what made me start [COMPANY] in the first place. Tell me what went wrong last time — I want to make sure I don''t repeat any of it."
Then
listen
. Carnegie''s rule: people who feel heard buy from you. Once they''ve vented, ask: "If I could guarantee none of that happens again, would you let me drone-scan it?"','["\"I''m sorry — and unfortunately I hear that a lot. Honestly the bad operators in our industry are what made me start [COMPANY] in the first place. Tell me what went wrong last time — I want to make sure I don''t repeat any of it.\""]'::jsonb,'[]'::jsonb,77,16)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709017','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I''ll get back to you."','"Of course — and just so we''re on the same page, what''s our next step look like? Are you calling me Friday, or do you want me to circle back Monday morning? Easier on you?"','["\"Of course — and just so we''re on the same page, what''s our next step look like? Are you calling me Friday, or do you want me to circle back Monday morning? Easier on you?\""]'::jsonb,'[]'::jsonb,35,17)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709018','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"Insurance won''t cover it."','"You may be right. Question — has an actual adjuster been out, or is that what someone told you on the phone? Because we get roofs approved every week that homeowners were told wouldn''t qualify. Let me drone-scan it. If there''s nothing, we walk away friends. If there''s something, I''ll show you the photos and you can decide."','["\"You may be right. Question — has an actual adjuster been out, or is that what someone told you on the phone? Because we get roofs approved every week that homeowners were told wouldn''t qualify. Let me drone-scan it. If there''s nothing, we walk away friends. If there''s something, I''ll show you the photos and you can decide.\""]'::jsonb,'[]'::jsonb,58,18)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709019','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I''m too old to invest in a new roof."','"Totally understand. Let me ask — are you planning to sell, or stay? If you''re staying, a leak in 5 years costs more than the roof. If you''re selling, an old roof drops your asking price by 2-3x the roof cost. Either way, the math is on our side. And we have financing if you''d rather not touch savings."','["\"Totally understand. Let me ask — are you planning to sell, or stay? If you''re staying, a leak in 5 years costs more than the roof. If you''re selling, an old roof drops your asking price by 2-3x the roof cost. Either way, the math is on our side. And we have financing if you''d rather not touch savings.\""]'::jsonb,'[]'::jsonb,59,19)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709020','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I''m selling soon anyway."','"That''s actually the best time. The #1 thing buyers and inspectors flag is the roof, and old roofs become a $5k-$15k negotiation hit. Most agents will tell you a new roof returns 100-110%, plus you don''t lose the sale. Let me show you the bid, you can decide if it makes sense before listing."','["\"That''s actually the best time. The #1 thing buyers and inspectors flag is the roof, and old roofs become a $5k-$15k negotiation hit. Most agents will tell you a new roof returns 100-110%, plus you don''t lose the sale. Let me show you the bid, you can decide if it makes sense before listing.\""]'::jsonb,'[]'::jsonb,54,20)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709021','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"It''s not leaking yet."','"And that''s a great time to do it. Once it''s leaking, you''re paying for the roof
plus
the drywall
plus
the insulation
plus
the mold remediation. We replace before the leak; that''s how you avoid the $40k version of this conversation."','["\"And that''s a great time to do it. Once it''s leaking, you''re paying for the roof\nplus\nthe drywall\nplus\nthe insulation\nplus\nthe mold remediation. We replace before the leak; that''s how you avoid the $40k version of this conversation.\""]'::jsonb,'[]'::jsonb,41,21)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709022','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"My nephew/buddy is a roofer."','"Awesome — keep him in the loop. All I''m offering is a free second opinion with drone photos he can use. Worst case, he confirms what I''m seeing and you give him the job. Best case, you get a competing bid that lowers his price. Either way you win."','["\"Awesome — keep him in the loop. All I''m offering is a free second opinion with drone photos he can use. Worst case, he confirms what I''m seeing and you give him the job. Best case, you get a competing bid that lowers his price. Either way you win.\""]'::jsonb,'[]'::jsonb,49,22)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709023','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I''ll get three bids."','"Smart move — that''s what I''d do. Two things though: one, make sure all three bids are apples-to-apples — same shingle grade, same underlayment, same warranty. Otherwise the cheap one is hiding something. Two, before you call anyone else, can I do my drone scan now so you''ve got photos you can show the other guys? Saves them a trip up and you a delay."','["\"Smart move — that''s what I''d do. Two things though: one, make sure all three bids are apples-to-apples — same shingle grade, same underlayment, same warranty. Otherwise the cheap one is hiding something. Two, before you call anyone else, can I do my drone scan now so you''ve got photos you can show the other guys? Saves them a trip up and you a delay.\""]'::jsonb,'[]'::jsonb,65,23)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555709024','11111111-2222-4333-8444-555555600009','11111111-2222-4333-8444-555555555501','"I trust my current contractor."','"That''s huge — and I''m not trying to replace him. I''m asking you to put me on your bench so you''ve got two phones to dial when something happens. Cost you nothing today. If your guy''s out of town when a leak hits, you''ve got me."','["\"That''s huge — and I''m not trying to replace him. I''m asking you to put me on your bench so you''ve got two phones to dial when something happens. Cost you nothing today. If your guy''s out of town when a leak hits, you''ve got me.\""]'::jsonb,'[]'::jsonb,46,24)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','💰 Closing Arsenal','15 closes drawn from Edwards, Hopkins, Tracy, Cardone, Ziglar. Learn 5 cold. Match the close to the moment.','sec-closes',10)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710000','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','1. Alternate of Choice (Edwards)','Never ask yes/no. Always two yeses.
"Would Tuesday or Thursday work better for the install?"
"Did you want the 30-year arch or the 50-year impact-resistant?"
"Are you putting it on the card today, or going with the financing?"','["\"Would Tuesday or Thursday work better for the install?\"", "\"Did you want the 30-year arch or the 50-year impact-resistant?\"", "\"Are you putting it on the card today, or going with the financing?\""]'::jsonb,'[]'::jsonb,38,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710001','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','2. Sharp Angle (Edwards)','Use when they raise an objection that''s actually a request. Throw it back as a close.
Prospect: "Can you knock $500 off?"
You: "If I could get that approved with my manager, would you be ready to authorize the paperwork right now?"
Prospect: "Could you start next week instead of in three weeks?"
You: "If I can move you up in the schedule, are we wrapping this up tonight?"','["Prospect: \"Can you knock $500 off?\"\nYou: \"If I could get that approved with my manager, would you be ready to authorize the paperwork right now?\"", "Prospect: \"Could you start next week instead of in three weeks?\"\nYou: \"If I can move you up in the schedule, are we wrapping this up tonight?\""]'::jsonb,'[]'::jsonb,69,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710002','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','3. Assumptive Close (Hopkins)','Skip "if we do this." Always "when we do this." Roll the paperwork out while talking.
"OK — so when the crew gets here, the dumpster goes in the driveway. Where do you want it — closer to the garage or by the curb?"
"Once we start, what''s the best way to reach you during the day if questions come up?"','["\"OK — so when the crew gets here, the dumpster goes in the driveway. Where do you want it — closer to the garage or by the curb?\"", "\"Once we start, what''s the best way to reach you during the day if questions come up?\""]'::jsonb,'[]'::jsonb,61,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710003','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','4. 1-2-3 Close (Hopkins)','"There are three good reasons to move forward today. One, the price holds at this number for 30 days, after that the manufacturer raises it. Two, your crew slot is reserved for the next 2 weeks — after that it pushes into rainy season. Three, your insurance claim window closes in 6 months and starts the clock. We solve all three by getting this signed tonight. Sound fair?"','["\"There are three good reasons to move forward today. One, the price holds at this number for 30 days, after that the manufacturer raises it. Two, your crew slot is reserved for the next 2 weeks — after that it pushes into rainy season. Three, your insurance claim window closes in 6 months and starts the clock. We solve all three by getting this signed tonight. Sound fair?\""]'::jsonb,'[]'::jsonb,68,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710004','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','5. Ben Franklin / T-Account (Edwards)','For the fence-sitter who can''t decide. Draw a line down a page. Reasons-to-do on the left. Reasons-not-to on the right. Help them with the left side.
Be silent
on the right side.
Left side prompts: "What did you say about the granule loss? Where would you put the warranty? What about the leak risk?" → Get to 8-10 reasons.
Right side: "OK, now you list the reasons not to." → They get to 1-2. The math wins itself.','[]'::jsonb,'[]'::jsonb,78,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710005','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','6. Summary Close (Tracy)','"Let me make sure I''ve got this right. You''re worried about the leak above the kitchen. You want it done before the kids are home for the holidays. Your budget''s in the 12-14 range. And you''d rather not deal with the insurance back-and-forth. All four of those are on the work order in front of me. Ready to authorize?"','["\"Let me make sure I''ve got this right. You''re worried about the leak above the kitchen. You want it done before the kids are home for the holidays. Your budget''s in the 12-14 range. And you''d rather not deal with the insurance back-and-forth. All four of those are on the work order in front of me. Ready to authorize?\""]'::jsonb,'[]'::jsonb,59,5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710006','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','7. Similar Situation (Edwards)','"Mr. and Mrs. Garcia over on Elm thought the same thing — they were going to wait. Six months later they had water in the master bedroom ceiling, drywall, insulation, and a mold remediation bill that came in north of $11k. The new roof would have been $9k. They told me they should have called me back. I don''t want you to be that story. Let''s just get this on the books."','["\"Mr. and Mrs. Garcia over on Elm thought the same thing — they were going to wait. Six months later they had water in the master bedroom ceiling, drywall, insulation, and a mold remediation bill that came in north of $11k. The new roof would have been $9k. They told me they should have called me back. I don''t want you to be that story. Let''s just get this on the books.\""]'::jsonb,'[]'::jsonb,72,6)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710007','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','8. Erroneous Conclusion (Edwards)','Mis-state on purpose. The correction confirms the sale.
You (writing): "So you said you wanted to start next spring, right?"
Prospect: "No, I said this fall."
You: "Oh, of course — this fall. Let me update that." [Continues writing.]','["You (writing): \"So you said you wanted to start next spring, right?\"\nProspect: \"No, I said this fall.\"\nYou: \"Oh, of course — this fall. Let me update that.\" [Continues writing.]"]'::jsonb,'[]'::jsonb,39,7)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710008','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','9. Puppy Dog (Edwards/Hopkins)','Let them "test drive" something. Hard to give the puppy back.
"Let me leave the actual shingle sample with you for the weekend. Set it next to the house, see how it looks. If it doesn''t fit, I''ll pick it up Monday and we''ll talk options."
(Commercial) "We do a 50-square test patch on your worst section, no charge. If you don''t see a difference in 30 days, we walk away. If you do, we have the conversation about the rest of the building."','["\"Let me leave the actual shingle sample with you for the weekend. Set it next to the house, see how it looks. If it doesn''t fit, I''ll pick it up Monday and we''ll talk options.\"", "(Commercial) \"We do a 50-square test patch on your worst section, no charge. If you don''t see a difference in 30 days, we walk away. If you do, we have the conversation about the rest of the building.\""]'::jsonb,'[]'::jsonb,84,8)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710009','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','10. Take-Away (Cardone)','Pull back. Trigger their re-engagement.
"You know what, this might not be the right fit. Let me ask — is this roof actually keeping you up at night, or are we doing this just to do it? Because if it''s not pressing, I''d rather you save your money."','["\"You know what, this might not be the right fit. Let me ask — is this roof actually keeping you up at night, or are we doing this just to do it? Because if it''s not pressing, I''d rather you save your money.\""]'::jsonb,'[]'::jsonb,48,9)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710010','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','11. The Lost Sale (Edwards)','For when the deal walks. Used at the door
after
they say no.
"Mrs. Jones, I''m clearly not going to earn your business today, and that''s OK. But for my own training — what''s the one thing I could have done differently?"
30% of the time, the real objection drops here.
Now handle it
: "OK — given that''s actually the issue, can I show you one thing real quick?" Get back in.','["\"Mrs. Jones, I''m clearly not going to earn your business today, and that''s OK. But for my own training — what''s the one thing I could have done differently?\""]'::jsonb,'[]'::jsonb,73,10)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710011','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','12. The Silence Close','Ask the closing question. Then shut up. The next person to talk loses.
"So we''re at $11,400 with the GAF Timberline HDZ and the lifetime workmanship warranty. Are we ready to get you on the schedule?"
[Silence. Count to ten in your head. Do not break it.]','["\"So we''re at $11,400 with the GAF Timberline HDZ and the lifetime workmanship warranty. Are we ready to get you on the schedule?\"\n[Silence. Count to ten in your head. Do not break it.]"]'::jsonb,'[]'::jsonb,47,11)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710012','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','13. Order Blank (Edwards)','Pull out the agreement. Start filling it in. Their not-stopping-you is the close.
"Let me start writing this up so we don''t lose any of the details. What''s the best phone number to reach you on a Tuesday morning?" [Write.] "Email for the warranty docs?" [Write.] "Just need your okay on the bottom line here."','["\"Let me start writing this up so we don''t lose any of the details. What''s the best phone number to reach you on a Tuesday morning?\" [Write.] \"Email for the warranty docs?\" [Write.] \"Just need your okay on the bottom line here.\""]'::jsonb,'[]'::jsonb,55,12)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710013','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','14. Reduction to the Ridiculous (Edwards)','Break the big number into a tiny one. Daily, monthly, per-square.
"$13,400 sounds like a lot until you spread it. 25 year warranty = 9,125 days. Comes out to $1.47 a day for a roof that doesn''t leak. Cheaper than your coffee."','["\"$13,400 sounds like a lot until you spread it. 25 year warranty = 9,125 days. Comes out to $1.47 a day for a roof that doesn''t leak. Cheaper than your coffee.\""]'::jsonb,'[]'::jsonb,42,13)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555710014','11111111-2222-4333-8444-555555600010','11111111-2222-4333-8444-555555555501','15. Empathy / Best-Interest Close','"Look — I''d rather you not buy this than buy it wrong. So here''s what I''d do if you were my mom: I''d take the mid-tier shingle, the full underlayment upgrade, and the financing — and I''d skip the ridge upgrade because for your house it''s overkill. That''s $11,800 instead of $14,200. You good with that?"','["\"Look — I''d rather you not buy this than buy it wrong. So here''s what I''d do if you were my mom: I''d take the mid-tier shingle, the full underlayment upgrade, and the financing — and I''d skip the ridge upgrade because for your house it''s overkill. That''s $11,800 instead of $14,200. You good with that?\""]'::jsonb,'[]'::jsonb,56,14)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600011','11111111-2222-4333-8444-555555555501','🎚️ Tonality & Pacing','Belfort''s claim: tonality is 70% of the sale, body language 20%, words 10%. He''s roughly right.','sec-tonality',11)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555711000','11111111-2222-4333-8444-555555600011','11111111-2222-4333-8444-555555555501','The 10 Tones to Practice','•
"I care, I really want to know"
— soft, slight upward inflection on the last word. Opens conversations.
•
Mysterious mystique
— drop volume, slow down. Leans them in.
•
Scarcity / "this is between us"
— quieter, conspiratorial. Used for offers, financing, exceptions.
•
The certainty tone
— flat, level, no waver. Not loud.
Certain
. Used at every close.
•
The money tone
— drop pitch, slow down, no apology. Say the price like it''s the weather.
•
The "I''m hesitating to share this"
— implies value is being revealed. "I probably shouldn''t say this, but…"
•
The warm-pivot
— used after an objection. Drop volume, soften pace, lean in vocally. "Hey, I totally get that…"
•
The reasonable man
— used when prospect is being unreasonable. Calm, steady, "I want to be fair here."
•
The implied obviousness
— used during summary. "Obviously, we''d want the lifetime warranty rather than the 25-year."
•
The smile-in-voice
— baseline. Always audible. If you can''t hear your own smile, neither can they.','[]'::jsonb,'[]'::jsonb,173,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555711001','11111111-2222-4333-8444-555555600011','11111111-2222-4333-8444-555555555501','Pacing — Slow Down to Win','•
Nervous = fast.
Confident = paced. Slow your speech 10-20% from baseline.
•
Micro-pauses (half-second) before key words
— "we found…
three
things on your roof." That pause makes "three" the headline.
•
Match their pace, then lead them down.
Mirror their first two sentences. Then slowly drop tempo. They follow.
•
End every closing question with a downward inflection.
Up = uncertain, down = decided. Practice this — it''s the #1 tonal mistake new reps make.','[]'::jsonb,'[]'::jsonb,78,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555711002','11111111-2222-4333-8444-555555600011','11111111-2222-4333-8444-555555555501','The Mirror Drill','Daily practice, 5 minutes:
•
Sit with a mirror or selfie camera
•
Read your opener with each of the 10 tones above
•
Record yourself. Listen back.
•
Which tone is hardest for you? That''s the one to drill 100 times this week.','[]'::jsonb,'[]'::jsonb,44,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555711003','11111111-2222-4333-8444-555555600011','11111111-2222-4333-8444-555555555501','The Smile Audible','•
The shape of your mouth changes the sound of consonants. A smile produces wider Hs, brighter As, a more open voice.
•
People can
hear
a smile through a phone line within 2 seconds. They can also hear its absence.
•
Put a small mirror on your desk if you cold call. Glance at it every 90 seconds. If you''re not smiling, fix it.','[]'::jsonb,'[]'::jsonb,65,3)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','🎭 Scenario Playbook','Live situations with the exact moves. Memorize 3-4 of these cold; you''ll see them every week.','sec-scenarios',12)
on conflict (id) do nothing;insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712000','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The Cranky Elderly Homeowner','Read:
alone, suspicious, has been burned before, doesn''t trust contractors.
Move:
step back further than normal. Compliment something specific about the house. Don''t sit unless invited. Offer to call a son/daughter/relative on speaker so they can be part of the conversation. Speak slower and lower. If they want to pause and call someone, encourage it loudly: "Please do, that''s the right move."
Don''t:
push paperwork in the first visit.
Do:
book a second visit when a family member can be present. You''ll close that one.','[]'::jsonb,'[]'::jsonb,85,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712001','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The Skeptical Engineer','Read:
wants data, distrusts emotional pitch, will look up everything you say.
Move:
drop the personality, give specs. ASTM ratings, wind uplift class, R-values, manufacturer warranty terms, installation specifications. Bring a one-pager with technical detail. Use the SPIN framework (Situation → Problem → Implication → Need-payoff).
Don''t:
exaggerate or guess. They will catch it.
Do:
say "I don''t know, let me find out and follow up" when you don''t know. It builds more trust than bluffing.','[]'::jsonb,'[]'::jsonb,76,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712002','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The "I''m Too Busy" Exec','Read:
values time above everything. Hates small talk.
Move:
"I respect your time — 30 seconds: [hook]. Two follow-up questions, then I''m gone." Be ruthlessly concise. Skip the rapport opener. Lead with the number.
Close move:
"Three options, I''ll send via email today. Which decision-maker should be on the thread besides you?"','[]'::jsonb,'[]'::jsonb,52,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712003','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The Price Shopper','Read:
already has 2 bids, has decided cheap = good.
Move:
don''t compete on price. Compete on apples-to-apples comparison. Ask to see the other bids. "What grade shingle did they spec? What underlayment? How many penetrations are they pricing? What''s their warranty length on labor?" 9 times out of 10, the cheap bid is missing $2-4k of work.
Don''t drop your price first.
Make them earn it. If they walk on price, hand them your card and say "the cheap one will leak in 4 years. I''ll see you then." Half the time they come back next week.','[]'::jsonb,'[]'::jsonb,98,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712004','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The Previous Bad Experience','Read:
burned by a roofer in the last 5 years. Defensive.
Move:
let them vent.
Fully
. Don''t interject. When they finish, say: "I''m sorry that happened. That''s why I do this work. Let me ask: what specifically went wrong — was it the install, the communication, the warranty, or the cleanup?" Pinpoint the wound. Address it directly in your own pitch.','[]'::jsonb,'[]'::jsonb,62,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712005','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The Hostile Spouse','Read:
one spouse warmed up, the other walked in and instantly opposed.
Move:
redirect to the hostile one. Their objection runs the deck. "I can tell roofing isn''t your favorite topic — and that''s fair. Real quick: if we were going to do this, what would your one biggest concern be?" Address it. Then check in with both: "We good? Both of you?"','[]'::jsonb,'[]'::jsonb,63,5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712006','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The Over-Qualified DIY Homeowner','Read:
retired carpenter, contractor, or "guy who does everything himself."
Move:
respect the expertise immediately. "Sounds like you''ve done your own work — that''s huge. Honestly the only reason most folks like you call us is the warranty, the workman''s comp, and the dumpster logistics. Want me to drone-scan it for free anyway, so you''ve got photos for your records?"','[]'::jsonb,'[]'::jsonb,60,6)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712007','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','Competitor''s Rep Is on the Property When You Walk Up','Move:
shake the competitor''s hand warmly, in front of the homeowner. "Hey man — looks like you got here first. Mind if I leave my card with [HOMEOWNER] in case they want a second number?" → To homeowner: "Smart move getting multiple eyes on it. Whatever you decide, make sure both bids spec the same underlayment and warranty. Take care."
Walk away with grace. Half the time the homeowner calls you back because you weren''t pushy.','[]'::jsonb,'[]'::jsonb,76,7)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712008','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The HOA-Restricted Neighborhood','Read:
homeowner wants to do something, HOA requires specific color/material.
Move:
be the rep who already knows the HOA spec. Pull up the architectural guidelines on your phone. Show them the 2-3 approved shingles. "I''ve done four houses in this HOA last year — here''s what they approve, here''s what they don''t. Saves you the submission headache."','[]'::jsonb,'[]'::jsonb,57,8)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555712009','11111111-2222-4333-8444-555555600012','11111111-2222-4333-8444-555555555501','The Slow-Pay Landlord','Read:
rental property, wants the cheapest fix, will haggle endlessly.
Move:
qualify hard upfront. "Quick — are we fixing this to keep tenants from leaving, fixing it before selling, or fixing it because something''s leaking right now?" Different answers = different bids. Don''t put your premium package in front of someone who''s clearly looking to spend the minimum. Offer the band-aid AND the proper fix. Let them pick.
Payment terms:
50% down minimum on landlord work. They forget invoices.','[]'::jsonb,'[]'::jsonb,79,9)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600013','11111111-2222-4333-8444-555555555501','⚡ Quick Reference Card','The one-pager. Print it. Tape it to your dashboard. Read it before every block.','sec-quickref',13)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555713000','11111111-2222-4333-8444-555555600013','11111111-2222-4333-8444-555555555501','The Pocket Card','Before the block (60 seconds)
•
Smile in the mirror
•
Say opener out loud once
•
"I''m here to help. No = next."
The opener (always 4 beats)
•
Identify yourself
•
Reference something specific to them
•
Name a problem
•
Low-commitment ask (8 minutes / drone scan / free photos)
Three problem hooks
•
Hail / wind damage (insurance angle)
•
Roof age + neighbors'' recent work
•
Visible failure (granule loss, curl, missing tab)
Three rebuttals to know cold
•
"Not interested" → "Totally fair. When''s the last time anyone actually looked at it?"
•
"Send info" → "Generic info isn''t useful — your roof is different. 15 minutes Thursday or Saturday?"
•
"Think about it" → "Sure — is it the price, timing, or the company? That''s the one to talk through now."
Three closes to know cold
•
Alternate of choice
— Thursday or Saturday?
•
Assumptive
— "When the crew gets here, where do you want the dumpster?"
•
Lost Sale
(at the door, after no) — "For my own training, what could I have done differently?"
Two trainer reminders
•
Edwards: "Ask the close, then shut up."
•
Belfort: "Tonality 70%, body 20%, words 10%."
The end of the day
•
Score yourself: contacts / problem-found / sit-downs / closes-attempted
•
Listen to one recording
•
Fix one thing tomorrow','[]'::jsonb,'[]'::jsonb,228,0)
on conflict (id) do nothing;
insert into public.training_modules (id, course_id, title, subtitle, source_anchor, sort_order)
values ('11111111-2222-4333-8444-555555600014','11111111-2222-4333-8444-555555555501','📚 New Rep 7-Day Ramp','A week-by-week plan to take a green rep to first close. Steal it, modify it, run it.','sec-training',14)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555714000','11111111-2222-4333-8444-555555600014','11111111-2222-4333-8444-555555555501','Day 1 — Mindset & Roof Types Crash Course','•
Morning:
read the Philosophy + Trainer Cheat Sheets sections out loud. Highlight 3 quotes you want to memorize.
•
Midday:
roof identification drill — drive 10 blocks with a coach, identify every roof system as you pass. Goal: 90% accuracy by 5pm.
•
Afternoon:
warranty / shingle line drill. Memorize your 3 main products cold (Timberline HDZ, Heritage, etc.) — features, warranty, install differences.
•
End of day:
watch one recorded D2D pitch from a veteran. Write 3 things you noticed.','[]'::jsonb,'[]'::jsonb,82,0)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555714001','11111111-2222-4333-8444-555555600014','11111111-2222-4333-8444-555555555501','Day 2 — Tonality Drills & Recording Yourself','•
Morning:
read the Tonality section. Pick 3 tones to drill.
•
Drill:
record yourself reading the master opener with all 10 tones. Listen back. Pick the 2 worst — drill those 50 more reps.
•
Afternoon:
mock pitch with a coach. They play hostile, tired, distracted, friendly. You stay on tone.
•
End of day:
10 minutes of pitch-out-loud in the mirror. Smiling. Slower than feels natural.','[]'::jsonb,'[]'::jsonb,68,1)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555714002','11111111-2222-4333-8444-555555600014','11111111-2222-4333-8444-555555555501','Day 3 — Cold Call Practice (50 supervised dials)','•
Morning:
read Cold Calling Mastery + Outreach sections. Pick your opener variant.
•
Block 1 (90 min):
25 dials, supervised. Coach listens. Stops you mid-call only for major issues. Notes afterward.
•
Lunch:
debrief. What worked? What didn''t? What''s the one thing to fix this afternoon?
•
Block 2 (90 min):
25 more dials. Apply the fix.
•
End of day:
goal isn''t to close. Goal is to make it past the opener on 5+ calls. Track it.','[]'::jsonb,'[]'::jsonb,79,2)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555714003','11111111-2222-4333-8444-555555600014','11111111-2222-4333-8444-555555555501','Day 4 — D2D Ride-Along','•
Morning:
read the D2D Combat Manual. Memorize the master opener.
•
Block 1:
shadow your coach on 20 doors. You watch. Don''t talk. Take notes on tone, body, what they say differently than you would.
•
Block 2:
you knock, coach shadows. Your goal: 20 doors, get past the opener on at least 4. Don''t try to close.
•
End of day:
ice cream / coffee debrief. One thing you did right. One thing to fix tomorrow.','[]'::jsonb,'[]'::jsonb,78,3)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555714004','11111111-2222-4333-8444-555555600014','11111111-2222-4333-8444-555555555501','Day 5 — Rebuttal Drills (Peer Practice)','•
Read
the Rebuttal Arsenal section in full.
•
Drill:
pair with another rep. They throw you objections at random. You answer in < 3 seconds. 30 minutes. Switch.
•
Drill 2:
film yourself answering 5 objections. Watch back. Look for filler words ("um," "like," "you know"). Cut them.
•
Afternoon:
live blocks with the new rebuttals in your pocket. Notice when you use one.','[]'::jsonb,'[]'::jsonb,65,4)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555714005','11111111-2222-4333-8444-555555600014','11111111-2222-4333-8444-555555555501','Day 6 — First Solo Block','•
Coach steps back. You''re on your own for a 3-hour block (D2D or phone, your choice).
•
Goals:
30 contacts. 8 past-the-opener. 2 sit-downs / inspections scheduled. 1 attempted close.
•
Closing the loop:
end of block, recap with coach. What did you feel? What surprised you? What''s the one new thing you noticed?','[]'::jsonb,'[]'::jsonb,55,5)
on conflict (id) do nothing;
insert into public.training_lessons (id, module_id, course_id, title, body, scripts, facts, word_count, sort_order)
values ('11111111-2222-4333-8444-555555714006','11111111-2222-4333-8444-555555600014','11111111-2222-4333-8444-555555555501','Day 7 — Debrief, Scorecard, Coach Review','•
Morning:
review the week''s recordings with coach. Pick top 3 wins, top 3 gaps.
•
Scorecard:
total dials, contacts, past-opener rate, sit-downs, attempted closes, actual closes.
•
Set Week 2 goals:
raise past-opener rate by 20%. Add 1 new close to your repertoire.
•
The Year-1 expectation:
first close usually weeks 2-4. By month 3, you should hit team average. By month 6, top half. If you''re still in the bottom half at month 9, the issue is coaching, not the rep — escalate.
"Sales is the highest-paid hard work and the lowest-paid easy work in the world. Show up tomorrow."
— attributed to many. Live it.','[]'::jsonb,'[]'::jsonb,108,6)
on conflict (id) do nothing;