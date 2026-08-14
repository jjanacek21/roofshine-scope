/**
 * CLAIM BUDDY — LOCKED PRESENTATION CONTENT (sections 03 through 08)
 *
 * This is the REAL slide content for the sit-down presentation. It is the same
 * content the finished deck uses. It is white-label: every brand-specific string
 * has been replaced with a token.
 *
 * SHAPE
 *   Each entry is { id, tab, icon, title, blurb, slides: string[] }
 *   `slides` is an array of HTML strings. Each string is ONE full-screen slide.
 *   Render them in order with the existing horizontal slide navigation.
 *
 * TOKENS to substitute at render time, per company, from cb_companies:
 *   {{COMPANY}}            -> cb_companies.name  (or legal_name where it reads as legal)
 *   {{WARRANTY_ROOFING}}   -> cb_companies.warranty_years (roofing workmanship)
 *   {{WARRANTY_TRADES}}    -> cb_companies.warranty_years_trades, fallback 10
 *
 * CSS CLASSES used by the slides (these must exist in the presentation stylesheet):
 *   split, rv, left, right, eyebrow, d1, d2, rule, lead, serif, gold, stats, stat,
 *   v, l, grid, g2, g3, ticks, callout, cap, tbl, note, big, kpi, chip, steps, step
 *   data-count / data-suffix drive the count-up-on-reveal animation.
 *
 * Sections 01 (About the company) and 02 (Our network) are NOT here — those render
 * from cb_companies.about_headline / about_story / founded_year / service_areas /
 * team_photo_url. Section 09 (Next steps) is built from the job and already exists.
 */


/* Inlined dependency: the seven-layer roof cutaway SVG used by the
   "Roofing systems" section. Keep it as-is. */
const ROOF_STACK=(function(){
  const rows=[
    ['1','SHINGLES','the visible wear layer — the only part every bid includes','L1'],
    ['2','STARTER COURSE &amp; RIDGE CAP','factory sealant at every edge; purpose-made cap at the peak','L2'],
    ['3','SYNTHETIC UNDERLAYMENT','secondary water barrier over the whole deck','L3'],
    ['4','ICE &amp; WATER BARRIER','eave to 24&quot; inside the wall line, plus every valley','L4'],
    ['5','DRIP EDGE &amp; FLASHINGS','metal at every edge, wall, valley and penetration','L5'],
    ['6','ROOF DECK','inspected, replaced where rotted, re-nailed to code','L6'],
    ['7','VENTILATION','balanced intake at the soffit + exhaust at the ridge','L7']
  ];
  let s='',l='';
  rows.forEach((r,i)=>{
    const y=30+i*48;
    s+=`<path d="M40 ${y+34} L300 ${y} L300 ${y+22} L40 ${y+56} Z" fill="url(#${r[3]})"/>`;
    l+=`<line x1="304" y1="${y+18}" x2="340" y2="${y+18}" stroke="#1B6FAF" stroke-width="2.5"/>`
      +`<circle cx="356" cy="${y+18}" r="14" fill="#122A54"/>`
      +`<text x="356" y="${y+23}" text-anchor="middle" fill="#4E9CD3" style="font-size:13px;font-weight:800">${r[0]}</text>`
      +`<text x="384" y="${y+14}" style="font-size:14px;font-weight:800">${r[1]}</text>`
      +`<text x="384" y="${y+31}" class="dl2">${r[2]}</text>`;
  });
  return `<g>${s}</g><g class="dl">${l}</g>`;
})();
/* ---------------------------- CONTENT ---------------------------- */

export const CB_LOCKED_SECTIONS = [
{ id:'claims', tab:'Insurance Claims', icon:'doc', title:'Insurance Claims',
  blurb:'Claim process · Estimate vs settlement · Supplements &amp; depreciation · Denied claims · Premium reduction.',
  slides:[
  `<div class="split">
     <div class="rv left">
       <div class="eyebrow">Section 03</div>
       <h1 class="d1" style="margin-top:18px">Insurance<br><span class="serif gold">Claims</span></h1>
       <div class="rule"></div>
       <p class="lead">There are a lot of good roofers out there. Very few are experts in the claim itself — and that gap is where homeowners lose thousands of dollars.</p>
     </div>
     <div class="rv right" style="transition-delay:.15s">
       <ul class="ticks" style="font-size:1.1em">
         <li><b>Insurance claim process</b></li>
         <li><b>Estimate vs. settlement</b></li>
         <li><b>Supplements &amp; depreciation</b></li>
         <li><b>Denied claims</b></li>
         <li><b>Premium reduction</b></li>
       </ul>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Insurance Claim Process</div><h2 class="d2" style="margin-top:16px">We work directly with your carrier.</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="rv"><ul class="ticks">
       <li>There are a lot of good roofers in every market, but very few are <b>experts in the claim process</b> — so they partner with public adjusters, which can delay your money by months and cost you a percentage of the claim.</li>
       <li><b>{{COMPANY}} works directly with your insurance company</b> on a contingent agreement to settle your claim as fast as possible, at no additional cost to you.</li>
       <li><b>All checks go to you.</b> We do not use assignment-of-benefits agreements. You stay in control of your money.</li>
     </ul></div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="card navyc"><span class="cap">Bottom line</span><h3>No public adjuster taking a percentage.</h3>
         <p>The claim work is part of the job because we're the ones building it. You keep your settlement; we earn the contract.</p></div>
       <div class="script rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">Rep talk track</span>
         <p>"A public adjuster takes ten percent of your claim to write a report. We do the same work, at no extra cost, because we're the ones who have to build it."</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Steps to Filing a Claim</div><h2 class="d2" style="margin-top:16px">Exactly how we run your claim</h2><div class="rule"></div></div>
   <div class="flow">
     <div class="step rv"><div class="n">1</div><h4>Photo report</h4><p>Full documented inspection of roof, siding, gutters, windows and soft metals with dated photos.</p></div>
     <div class="step rv" style="transition-delay:.06s"><div class="n">2</div><h4>Detailed line-item estimate</h4><p>Written in the same estimating software your carrier uses, for <b>ALL work</b> needing to be done on the property — not just the roof.</p></div>
     <div class="step rv" style="transition-delay:.12s"><div class="n">3</div><h4>Proof of codes &amp; laws</h4><p>We document the current code requirements pertaining to your village so code upgrades get included, not denied.</p></div>
     <div class="step rv" style="transition-delay:.18s"><div class="n">4</div><h4>Meet the adjuster</h4><p>We walk the property with the field adjuster. Nobody inspects your roof without our representative present.</p></div>
     <div class="step rv" style="transition-delay:.24s"><div class="n">5</div><h4>Communicate with the desk adjuster</h4><p>Direct line to the person who actually approves the money.</p></div>
     <div class="step rv" style="transition-delay:.30s"><div class="n">6</div><h4>Follow up every couple of days</h4><p>Until the claim is settled. Claims don't move on their own.</p></div>
     <div class="step rv" style="transition-delay:.36s"><div class="n">7</div><h4>Mortgage loss-draft department</h4><p>We work with your lender's loss-draft department to get the checks endorsed and released.</p></div>
     <div class="step rv" style="transition-delay:.42s"><div class="n">8</div><h4>All checks go to you</h4><p><b>We don't use AOBs.</b> Every dollar is issued in your name.</p></div>
     <div class="step rv" style="transition-delay:.48s"><div class="n">9</div><h4>Submit invoices</h4><p>Final invoices and completion photos go to your carrier to get the remaining funds released.</p></div>
     <div class="step rv" style="transition-delay:.54s"><div class="n">10</div><h4>If your claim is denied</h4><p>We have the documentation, the engineers and the legal resources to fight it — see the denied-claim slide.</p></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Estimate vs. Settlement</div><h2 class="d2" style="margin-top:16px">The gap nobody explains</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="card rv"><span class="cap">Step One</span><h3>Insurance Estimate</h3><p>The carrier's first number — written by an adjuster who was on your roof for twenty minutes and may have missed the collateral damage entirely.</p></div>
     <div class="card rv" style="transition-delay:.1s"><span class="cap">Step Two</span><h3>Our Estimate</h3><p>Every line item required to restore the property to pre-loss condition <b>and</b> to current building code — documented, priced and defensible.</p></div>
     <div class="card navyc rv" style="transition-delay:.2s"><span class="cap">Step Three</span><h3>Insurance Settlement</h3><p>What the carrier actually pays once the missing items have been proven. This is almost always higher than the first estimate.</p></div>
   </div>
   <div class="grid g2 rv" style="margin-top:26px;transition-delay:.24s">
     <table class="tbl">
       <tr><th>Term</th><th>What it means to you</th></tr>
       <tr><td>RCV</td><td>Replacement Cost Value — what it costs to rebuild today.</td></tr>
       <tr><td>ACV</td><td>Actual Cash Value — RCV minus depreciation. This is your first check.</td></tr>
       <tr><td>Depreciation</td><td>The "age" the carrier holds back. Recoverable depreciation is paid <b>after</b> the work is done.</td></tr>
       <tr><td>Deductible</td><td>Your portion. It is not optional and cannot legally be waived.</td></tr>
       <tr><td>Law &amp; Ordinance</td><td>Coverage that pays for code-required upgrades. Most policies have it — most homeowners never claim it.</td></tr>
     </table>
     <div class="script"><span class="cap">Rep talk track</span>
       <p>"Your first check is not your settlement. If you take that check and hire the cheapest guy to do a partial repair, you just donated your recoverable depreciation back to your insurance company — and you still have an old roof."</p></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Line By Line</div><h2 class="d2" style="margin-top:16px">Where the money actually goes missing</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="card"><span class="cap">Carrier's first estimate</span><div class="bignum" style="font-size:clamp(2.6rem,5.4vw,4.4rem)">$29,516</div>
       <p style="margin-top:12px">Roof only. Tear-off, felt, starter, shingles, ridge, a few vents. Written from a twenty-minute walk.</p></div>
     <div class="card navyc"><span class="cap">Our line-item estimate</span><div class="bignum" style="font-size:clamp(2.6rem,5.4vw,4.4rem)">$40,241</div>
       <p style="margin-top:12px">Same roof — plus every code item, every flashing, the gutters, the debris haul and the detach-and-reset work the first estimate left off.</p></div>
     <div class="card wash"><span class="cap">The difference</span><div class="bignum" style="font-size:clamp(2.6rem,5.4vw,4.4rem)">+36%</div>
       <p style="margin-top:12px">Documented, submitted and approved as a supplement — not negotiated, <b>proven</b>. Illustrative example based on a typical supplemented storm claim.</p></div>
   </div>
   <div class="grid g2" style="margin-top:26px">
     <div class="card edge"><span class="cap">Line items that get left off — every single time</span>
       <ul class="ticks" style="margin-top:16px">
         <li><b>Re-nail roof sheathing</b> — complete re-nail to current code</li>
         <li><b>R&amp;R valley metal</b> and <b>drip edge / gutter apron</b></li>
         <li><b>Asphalt starter</b> — universal starter course at eaves <i>and</i> rakes</li>
         <li><b>Caulking — butyl rubber</b> at the drip edge flange, valleys and flashings</li>
       </ul></div>
     <div class="card edge"><span class="cap">…and these</span>
       <ul class="ticks" style="margin-top:16px">
         <li><b>R&amp;R ridge cap</b> — manufactured cap, not field shingles cut into thirds</li>
         <li><b>Pipe jacks</b> — lead and split boot · <b>flat roof exhaust vent / gooseneck</b></li>
         <li><b>Meter mast — detach &amp; reset</b> and <b>mastic around vent pipes</b></li>
         <li><b>Gutters &amp; downspouts</b> and the <b>dump trailer / debris haul</b></li>
       </ul></div>
   </div>
   <div class="script" style="margin-top:24px"><span class="cap">Rep talk track</span>
     <p>"I'm not arguing with your adjuster about price. I'm handing them a list of things the roof legally has to have, that their estimate doesn't include. That's not a negotiation — that's a correction."</p></div>`,
  `<div class="rv"><div class="eyebrow">Supplements &amp; Depreciation</div><h2 class="d2" style="margin-top:16px">95% of claims need to be supplemented.</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="rv"><ul class="ticks">
       <li><b>95% of claims need to be supplemented</b> due to the rapid change in building codes since your house or roof was built.</li>
       <li>If you have an <b>RCV policy with law &amp; ordinance coverage</b>, the insurance company reimburses you for those code items.</li>
       <li><b>We submit all supporting documents</b> to get that money reimbursed to you when the job is completed.</li>
       <li>If the job is completed before all the money is released, <b>we have financing options</b> to bridge the balance while you wait on the funds.</li>
       <li><b>Hidden damage appears at tear-off</b> — rotted decking, failed flashing, delaminated sheathing. Documented, photographed, supplemented.</li>
     </ul></div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="callout"><span class="cap">Cold-climate code item — not an upsell</span>
         <h3>Ice &amp; water barrier is required by code.</h3>
         <p>In climates with a history of ice forming along the eaves, code requires a self-adhering ice barrier running from the eave edge to at least <b>24 inches inside the exterior wall line</b>. On a low-slope or wide-overhang roof that can be two or three courses. If it isn't on the carrier's estimate, it was missed.</p></div>
       <div class="script rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">Rep talk track</span>
         <p>"I'm not adding items to run your bill up. I'm adding items because the Village won't pass final inspection without them — and your policy already pays for code."</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Denied Claims</div><h2 class="d2" style="margin-top:16px">"Denied" and "repair only" are opening positions.</h2><div class="rule"></div></div>
   <div class="stats rv" style="margin-bottom:26px">
     <div class="stat"><div class="v" data-count="75" data-suffix="%">0%</div><div class="l">Of roof claims start out as denials or repairs</div></div>
     <div class="stat"><div class="v" data-count="95" data-suffix="%">0%</div><div class="l">Of denials &amp; partial repairs we overturn</div></div>
     <div class="stat"><div class="v" data-count="98" data-suffix="%">0%</div><div class="l">Of the time we get the claim paid for</div></div>
     <div class="stat"><div class="v">Fast<br>Track</div><div class="l">Get your roof replaced while you wait on a proper settlement</div></div>
   </div>
   <div class="grid g2">
     <div class="card edge rv"><span class="cap">What we do about it</span>
       <ul class="ticks" style="margin-top:14px">
         <li><b>Re-inspection request</b> with our full documentation package.</li>
         <li><b>Engineering reports</b> when the carrier disputes causation.</li>
         <li><b>Matching arguments</b> — if the damaged shingle or siding profile is discontinued, a spot repair can't restore uniform appearance.</li>
         <li><b>Appraisal clause</b> — most policies contain a dispute-resolution provision homeowners never hear about.</li>
       </ul></div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="callout"><span class="cap">The trap</span><h3>A repair today can cost you the roof tomorrow.</h3>
         <p>Carriers increasingly non-renew policies on aging or patched roofs. Homeowners who accepted a repair check often find out two years later that they can't get coverage — or can't sell the house — without replacing the roof out of pocket.</p></div>
       <div class="card rv" style="margin-top:20px;border-left:6px solid #C4543A;transition-delay:.2s">
         <span class="cap" style="color:#C4543A">Important</span>
         <p><b>Timing matters.</b> Most homeowner policies require you to report a loss promptly and to file suit within a limited window. Check your policy's "Duties After Loss" and "Suit Against Us" sections. We are contractors — not attorneys or public adjusters — and nothing here is legal advice.</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Reductions In Premiums</div><h2 class="d2" style="margin-top:16px">The most expensive roof is the one you buy twice.</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="rv"><ul class="ticks">
       <li>If you plan on living in your home for the next 10–15 years, there's a good chance you'll receive a <b>non-renewal letter</b> or be forced to deduct the value of the roof when you sell.</li>
       <li>Carriers increasingly treat roofs over a certain age as high risk — <b>an old roof is a coverage problem, not just a leak problem</b>.</li>
       <li>Upgrading to an <b>impact-resistant Class 4 or metal system</b> can qualify you for a premium credit — many carriers offer one. Ask your agent for their exact number.</li>
       <li>Financing a new roof and keeping your rates down is, in most cases, <b>cheaper than insuring an old roof</b>.</li>
     </ul></div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="card navyc" style="text-align:center;padding:clamp(28px,3.6vw,44px)">
         <span class="cap">Potential premium credit</span>
         <div class="bignum" style="margin:12px 0">30%</div>
         <p>Insurance companies incentivize upgrades because impact-rated and metal systems file dramatically fewer claims. Confirm the credit with your agent before you decide.</p>
       </div>
       <div class="script rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">Rep talk track</span>
         <p>"Call your agent while I'm sitting here. Ask two questions: what's my credit for a Class 4 impact roof, and what happens to my policy when this roof turns twenty."</p></div>
     </div>
   </div>`
]},
{ id:'production', tab:'Production', icon:'cal', title:'Production Process',
  blurb:'What actually happens from the day you sign to the final walkthrough.',
  slides:[
  `<div class="split">
     <div class="rv left">
       <div class="eyebrow">Section 04</div>
       <h1 class="d1" style="margin-top:18px">Production<br><span class="serif gold">Process</span></h1>
       <div class="rule"></div>
       <p class="lead">Signing is the easy part. Here's exactly what happens next, who does it, and how long each step takes.</p>
     </div>
     <div class="rv right" style="transition-delay:.15s">
       <div class="card navyc"><span class="cap">Our commitment</span><h3>You will always know what's next.</h3>
         <p>A written timeline, a single point of contact, and a call before anybody shows up at your house. If the schedule moves — and storm-season weather moves schedules — you hear it from us first.</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Timeline</div><h2 class="d2" style="margin-top:16px">From signature to final inspection</h2><div class="rule"></div></div>
   <div class="flow">
     <div class="step rv"><div class="n">1</div><h4>Agreement signed</h4><p><b>Day 0.</b> Scope, color selections and payment terms confirmed in writing.</p></div>
     <div class="step rv" style="transition-delay:.06s"><div class="n">2</div><h4>Color &amp; product selection</h4><p><b>Day 0–3.</b> Shingle, siding, gutter and trim colors chosen. HOA approval submitted if required.</p></div>
     <div class="step rv" style="transition-delay:.12s"><div class="n">3</div><h4>Measurements &amp; material order</h4><p><b>Day 1–5.</b> Aerial measurement report ordered; materials staged with the supplier.</p></div>
     <div class="step rv" style="transition-delay:.18s"><div class="n">4</div><h4>Village permit pulled</h4><p><b>Day 3–14.</b> Timing varies by municipality. We handle the application and the fees.</p></div>
     <div class="step rv" style="transition-delay:.24s"><div class="n">5</div><h4>Build date scheduled</h4><p>A confirmed date plus a weather contingency day. Delivery lands the day before or morning of.</p></div>
     <div class="step rv" style="transition-delay:.30s"><div class="n">6</div><h4>Tear-off &amp; deck inspection</h4><p>Old system removed to the deck. Rotted or delaminated sheathing documented for supplement.</p></div>
     <div class="step rv" style="transition-delay:.36s"><div class="n">7</div><h4>Install to manufacturer spec</h4><p>Ice barrier, underlayment, starter, flashing, field shingles, ventilation, ridge cap — in that order, to spec.</p></div>
     <div class="step rv" style="transition-delay:.42s"><div class="n">8</div><h4>Cleanup &amp; magnet sweep</h4><p>Debris hauled, gutters cleared, property magnet-swept — usually more than once.</p></div>
     <div class="step rv" style="transition-delay:.48s"><div class="n">9</div><h4>Village final inspection</h4><p>Municipal inspector signs off. This is exactly why the code items on the estimate matter.</p></div>
     <div class="step rv" style="transition-delay:.54s"><div class="n">10</div><h4>Final walkthrough &amp; warranty</h4><p>We walk the property together, issue the workmanship warranty and submit the final invoice to release depreciation.</p></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Build Day</div><h2 class="d2" style="margin-top:16px">What a build day looks like at your house</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="card rv"><span class="cap">Before we start</span>
       <ul class="ticks" style="margin-top:14px">
         <li>Move vehicles out of the driveway and away from the house.</li>
         <li>Take down loose wall hangings — tear-off vibrates the structure.</li>
         <li>Cover stored items in the attic and garage; dust falls through.</li>
         <li>Plan for pets and small children to be elsewhere. It is loud.</li>
         <li>Point out sprinkler heads, septic lids, invisible fence lines and garden beds.</li>
       </ul></div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="card navyc"><span class="cap">Our standard</span><h3>Daily site rules</h3>
         <p>Tarps down before the first shingle comes off. Debris into the dumpster, not the lawn. Magnet run at the end of every day and again at completion. Gutters cleaned of nails and granules before we leave.</p></div>
       <div class="card edge rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">Weather</span>
         <p>We will not open a roof we can't dry in the same day. If the forecast turns, we reschedule — and we call you before you find out from the driveway.</p></div>
     </div>
   </div>`
]},
{ id:'roofing', tab:'Residential Roofing', icon:'layers', title:'Residential Roofing',
  blurb:'Good · Better · Best · Underlayment, ventilation, flashings &amp; accessories · Building codes · Warranty.',
  slides:[
  `<div class="split">
     <div class="rv left">
       <div class="eyebrow">Section 05</div>
       <h1 class="d1" style="margin-top:18px">Residential<br><span class="serif gold">Roofing</span></h1>
       <div class="rule"></div>
       <p class="lead">Good, Better, Best &amp; Specialty · Underlayment, Flashings &amp; Accessories · Building Codes · Roof Maintenance &amp; Warranty</p>
     </div>
     <div class="rv right" style="transition-delay:.15s">
       <div class="script"><span class="cap">Rep talk track</span>
         <p>"Every bid you get will say 'architectural shingles.' That's the one part everybody includes. What separates a fifteen-year roof from a thirty-year roof is everything underneath it — and that's what I'm going to walk you through."</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Anatomy</div><h2 class="d2" style="margin-top:16px">The seven layers of a complete roof system</h2><div class="rule"></div></div>
   <div class="diagram rv zoom">
     <svg viewBox="0 0 960 400" role="img" aria-label="Exploded view of the layers of a roof system">
       <defs>
         <linearGradient id="L1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#333A46"/><stop offset="1" stop-color="#1B2230"/></linearGradient>
         <linearGradient id="L2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4E5A6E"/><stop offset="1" stop-color="#36435A"/></linearGradient>
         <linearGradient id="L3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8B9BB2"/><stop offset="1" stop-color="#6E7F98"/></linearGradient>
         <linearGradient id="L4" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2F6FB0"/><stop offset="1" stop-color="#1F4D80"/></linearGradient>
         <linearGradient id="L5" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#BCC6D4"/><stop offset="1" stop-color="#93A0B3"/></linearGradient>
         <linearGradient id="L6" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7FB3DA"/><stop offset="1" stop-color="#2C6FA3"/></linearGradient>
         <linearGradient id="L7" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4E9CD3"/><stop offset="1" stop-color="#1B6FAF"/></linearGradient>
       </defs>
       ${ROOF_STACK}
     </svg>
   </div>`,
  `<div class="rv"><div class="eyebrow">Good · Better · Best · Specialty</div><h2 class="d2" style="margin-top:16px">Choosing your system</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="tier t1 rv">
       <div class="head">Good — Architectural Asphalt</div>
       <div class="body2"><p>The workhorse of the Midwest. A quality laminated architectural shingle installed to spec is a genuinely good roof — and it's what the vast majority of insurance claims pay for.</p>
         <ul><li>Wind rating to 110–130 mph with the manufacturer's nailing pattern</li><li>Widest color selection, HOA-friendly</li><li>Best value if you may sell within 10 years</li></ul></div>
       <div class="foot">Insurance-standard replacement</div>
     </div>
     <div class="tier t2 rv" style="transition-delay:.1s">
       <div class="head">Better — Class 4 Impact-Resistant</div>
       <div class="body2"><p>An SBS-modified, polymer-reinforced shingle engineered to absorb hail rather than fracture. In a top-three hail state, this is the upgrade that pays for itself.</p>
         <ul><li>UL 2218 Class 4 impact rating — the highest available</li><li><b>Premium credit from many carriers</b> — ask your agent</li><li>Far less likely to need another claim after the next hail event</li></ul></div>
       <div class="foot">Best value in a hail market</div>
     </div>
     <div class="tier t3 rv" style="transition-delay:.2s">
       <div class="head">Best / Specialty — Metal &amp; Designer</div>
       <div class="body2"><p>Standing seam metal, stone-coated steel, synthetic slate and synthetic shake. A roof you install once and stop thinking about.</p>
         <ul><li>Standing seam: concealed fasteners, 40–70 year service life</li><li>Sheds snow and dramatically reduces ice-dam risk</li><li>Stone-coated steel gives a tile or shake look at a fraction of the weight</li></ul></div>
       <div class="foot">Lifetime solution · Highest resale impact</div>
     </div>
   </div>
   <div class="card edge rv" style="margin-top:26px;transition-delay:.24s"><span class="cap">Honest advice</span>
     <p>Staying in this house more than ten years in a hail corridor? <b>Ask us about Class 4.</b> Between the carrier credit and not filing another hail claim, the upgrade math usually works in your favor. Selling in three years? The standard architectural shingle is the right call, and we'll tell you so.</p></div>`,
  `<div class="rv"><div class="eyebrow">Asphalt Shingles</div><h2 class="d2" style="margin-top:16px">We work with all the major manufacturers.</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="card navyc rv"><span class="cap">Our primary partner</span><h3>Atlas Roofing</h3>
       <p style="margin-top:10px">Two things Midwest homeowners actually feel: the <b>HP42&trade; oversized format</b>, which covers more deck with fewer seams and nail lines, and <b>3M Scotchgard&trade; Protector</b>, which keeps black algae streaking off your north-facing slopes.</p>
       <ul class="ticks" style="margin-top:18px">
         <li><b>Pinnacle&reg; Pristine</b> — high-performance architectural shingle, algae-resistant, deep shadow lines.</li>
         <li><b>StormMaster&reg; Shake</b> — Class 4 impact-rated, SBS polymer-modified. The hail answer.</li>
         <li><b>Signature Select&reg;</b> — enhanced system warranty when the full component system is installed by a qualifying contractor.</li>
       </ul></div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="card"><span class="cap">Also available</span><h3>Not locked into one brand</h3>
         <p>CertainTeed, GAF Timberline&reg; HDZ&trade;, Owens Corning and TAMKO are all available if you have a preference, a color-match need, or an HOA specification. We'll tell you honestly where the differences are real and where they're marketing.</p></div>
       <div class="card edge rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">System warranties</span>
         <p>We can offer <b>manufacturer system warranties other roofing contractors can't</b> — but they require that the underlayment, starter, ridge and ventilation all come from the same manufacturer and are installed by a certified crew.</p></div>
       <div class="script rv" style="margin-top:20px;transition-delay:.28s"><span class="cap">Rep talk track</span>
         <p>"Every manufacturer makes a good shingle. Almost none of them will honor a warranty on a roof that was nailed wrong. Ask any contractor to show you their nailing pattern — watch what happens."</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Metal Roofing</div><h2 class="d2" style="margin-top:16px">Exposed fastener vs. standing seam</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="card"><span class="cap">The value option</span><h3>5V Crimp &amp; R-Panel — exposed fastener</h3>
       <p>The "blue collar metal roof." An exposed-fastener panel is a great option when you want the durability of metal without the standing-seam price.</p>
       <ul class="ticks" style="margin-top:16px">
         <li>Only modestly more than a shingle roof</li>
         <li>Mill finish (bare silver) or factory color-coated</li>
         <li>Installed correctly, rated for <b>very high wind loads</b></li>
         <li>Can qualify you for an insurance premium reduction</li>
       </ul></div>
     <div class="card navyc"><span class="cap">The gold standard</span><h3>Standing Seam — concealed fastener</h3>
       <p>Out of all roofing systems, standing seam reigns superior in wind protection and curb appeal — which is why it's the preferred choice for most homeowners who plan to stay.</p>
       <ul class="ticks" style="margin-top:16px">
         <li>No fasteners penetrating the weather surface</li>
         <li>Sheds snow — dramatically reduces ice-dam risk</li>
         <li>40–70 year service life; often the last roof the house needs</li>
       </ul></div>
   </div>
   <div class="grid g3" style="margin-top:26px">
     <div class="card wash"><span class="cap">Profiles</span>
       <ul class="ticks" style="margin-top:14px"><li>1" Snaplock</li><li>1.5" Snaplock with clips</li><li>1.75" Mechanically fastened</li></ul></div>
     <div class="card wash"><span class="cap">Gauges</span>
       <ul class="ticks" style="margin-top:14px"><li>24 &amp; 26 gauge galvanized steel</li><li>0.032 &amp; 0.040 gauge aluminum</li></ul></div>
     <div class="card wash"><span class="cap">Finishes</span>
       <ul class="ticks" style="margin-top:14px"><li>Mill finish (no color)</li><li>SMP coated</li><li>Kynar&reg; coated — the premium, fade-resistant finish</li></ul></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Specialty Roof Systems</div><h2 class="d2" style="margin-top:16px">When you want the look without the liability</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="card"><span class="cap">Specialty</span><h3>Stone-coated steel</h3><p>A steel panel finished with stone granules — the appearance of tile or shake at a fraction of the weight, with metal's wind and impact performance. Excellent where a structure can't carry real tile.</p></div>
     <div class="card"><span class="cap">Specialty</span><h3>Synthetic slate</h3><p>Composite slate with the depth and shadow of quarried stone, without the weight, the brittleness or the cost of a slate roof — and it won't crack under Midwest hail.</p></div>
     <div class="card"><span class="cap">Specialty</span><h3>Synthetic shake</h3><p>Cedar-shake appearance in a composite profile. No splitting, no rot, no annual treatment — and Class 4 impact options are available.</p></div>
   </div>
   <div class="grid g2" style="margin-top:26px">
     <div class="card edge"><span class="cap">Roof accessories &amp; add-ons</span>
       <ul class="ticks" style="margin-top:16px">
         <li><b>Skylights</b> — replace or re-flash at the same time as the roof. Flashing a 20-year-old skylight into a new roof is borrowing trouble.</li>
         <li><b>Sun tunnels</b> — daylight into interior hallways and baths with no framing changes.</li>
         <li><b>Solar attic fans</b> — active exhaust with no wiring run.</li>
         <li><b>Snow guards</b> — required on metal roofs above entries, walkways and driveways.</li>
         <li><b>Heat cable</b> — a band-aid for chronic ice dams; ventilation and insulation are the actual fix.</li>
       </ul></div>
     <div class="callout"><span class="cap">Choosing honestly</span><h3>The right roof depends on how long you're staying.</h3>
       <p>Selling in three years? Architectural asphalt is the right call and we'll say so. Staying ten-plus years in a hail corridor? Class 4 or metal will very likely cost you less over the hold — between the premium credit and never filing another hail claim.</p></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Underlayment</div><h2 class="d2" style="margin-top:16px">Felt vs. peel-and-stick — the secondary water barrier</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="card rv"><span class="cap">Layer 1</span><h3>Ice &amp; water barrier</h3><p>Self-adhering rubberized membrane that seals around every nail. Required by code at eaves in ice-dam climates — edge to at least <b>24 inches inside the heated wall line</b>. We also run it in valleys and around every penetration.</p></div>
     <div class="card rv" style="transition-delay:.1s"><span class="cap">Layer 2</span><h3>Synthetic underlayment</h3><p>Replaces old #15 felt across the field. Won't wrinkle, won't tear in wind, won't absorb water — and it's far safer for the crew to walk, which means a more precise install.</p></div>
     <div class="card rv" style="transition-delay:.2s"><span class="cap">Layer 3</span><h3>Starter course &amp; drip edge</h3><p>Manufactured starter strip with a factory sealant line at eaves and rakes — <b>not</b> upside-down shingles. Metal drip edge on every edge to carry water into the gutter instead of behind it.</p></div>
   </div>
   <div class="callout rv" style="margin-top:26px;transition-delay:.24s"><span class="cap">Why this is the ice-dam fix</span>
     <h3>Ice dams don't come from the roof. They come from the attic.</h3>
     <p>Warm air escapes into the attic, melts snow at the ridge, water runs down and refreezes at the cold eave. The dam builds, water backs up under the shingles, and it ends up in your ceiling. The permanent fix is three things together: <b>ice barrier</b> at the eave, <b>balanced ventilation</b>, and <b>attic insulation</b> at the right depth.</p></div>`,
  `<div class="rv"><div class="eyebrow">Ventilation</div><h2 class="d2" style="margin-top:16px">Static &amp; active — they only work in pairs</h2><div class="rule"></div></div>
   <div class="split">
     <div class="diagram rv left">
       <svg viewBox="0 0 820 340" role="img" aria-label="Attic ventilation diagram">
         <path d="M110 270 L410 100 L710 270 Z" fill="#FBF7EF" stroke="#D9D3C7" stroke-width="2.5"/>
         <rect x="110" y="270" width="600" height="54" fill="#F1F4F9" stroke="#D9D3C7" stroke-width="2.5"/>
         <text x="410" y="303" text-anchor="middle" class="dl">CONDITIONED LIVING SPACE</text>
         <rect x="118" y="256" width="584" height="14" fill="#F0CACA" stroke="#DCA9A9"/>
         <text x="410" y="248" text-anchor="middle" class="dl2">attic insulation — depth matters</text>
         <path d="M380 102 L410 84 L440 102 L440 110 L410 94 L380 110 Z" fill="#1B6FAF"/>
         <text x="410" y="34" text-anchor="middle" class="dl">RIDGE VENT — EXHAUST</text>
         <path d="M410 80 L410 48" stroke="#C4543A" stroke-width="5" stroke-linecap="round"/>
         <path d="M400 60 L410 46 L420 60" fill="none" stroke="#C4543A" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M56 278 L128 262" stroke="#2F6FB0" stroke-width="5" stroke-linecap="round"/>
         <path d="M112 253 L130 262 L114 272" fill="none" stroke="#2F6FB0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
         <path d="M764 278 L692 262" stroke="#2F6FB0" stroke-width="5" stroke-linecap="round"/>
         <path d="M708 253 L690 262 L706 272" fill="none" stroke="#2F6FB0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
         <text x="48" y="300" text-anchor="start" class="dl">SOFFIT INTAKE</text>
         <text x="772" y="300" text-anchor="end" class="dl">SOFFIT INTAKE</text>
         <path d="M180 256 Q 300 180 400 120" stroke="#2F6FB0" stroke-width="3" fill="none" stroke-dasharray="8 7" opacity=".8"/>
         <path d="M640 256 Q 520 180 420 120" stroke="#2F6FB0" stroke-width="3" fill="none" stroke-dasharray="8 7" opacity=".8"/>
         <text x="410" y="190" text-anchor="middle" class="dl2">cool dry air washes the underside of the deck</text>
       </svg>
     </div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="card"><span class="cap">The rule</span><h3>Balanced ventilation</h3>
         <p>Code calls for roughly <b>1 sq ft of net free vent area per 150 sq ft</b> of attic floor — cut to 1:300 when vents are balanced between eave and ridge. Half in at the soffit, half out at the ridge. <b>Exhaust without intake just pulls conditioned air out of your house.</b></p></div>
       <div class="card rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">Static &amp; active options</span>
         <ul class="ticks" style="margin-top:14px">
           <li><b>Aluminum ridge vent · shingle-over ridge vent · off-ridge vent</b> — static exhaust at the peak.</li>
           <li><b>Soffit &amp; edge intake vents</b> — the half almost everybody skips.</li>
           <li><b>Power &amp; solar attic fans</b> — active ventilation with thermostat and humidistat. Situational; we'll tell you honestly if your house needs one.</li>
           <li><b>Baffles</b> — keep blown insulation from choking the intake at the eave.</li>
         </ul></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Flashings &amp; Accessories</div><h2 class="d2" style="margin-top:16px">Where roofs actually leak</h2><div class="rule"></div></div>
   <div class="grid g4">
     <div class="card rv"><h3>Step flashing</h3><p>Individual pieces woven course-by-course where roof meets wall — never one bent strip of aluminum.</p></div>
     <div class="card rv" style="transition-delay:.05s"><h3>Counter flashing</h3><p>Cut or surface-mounted into the masonry above the step flashing at the chimney.</p></div>
     <div class="card rv" style="transition-delay:.1s"><h3>Kickout / rain diverter</h3><p>The small diverter at the bottom of a roof-to-wall junction. Missing kickouts rot siding for years.</p></div>
     <div class="card rv" style="transition-delay:.15s"><h3>Valley metal</h3><p>Open metal or closed-cut valleys built to handle the concentrated water and ice load.</p></div>
     <div class="card rv" style="transition-delay:.2s"><h3>Pipe jacks — split boot &amp; lead</h3><p>Rubber boots dry-rot and crack. Often the true source of a "roof leak." Replaced every time.</p></div>
     <div class="card rv" style="transition-delay:.25s"><h3>Chimney cricket / saddle</h3><p>A saddle behind a wide chimney splits water around it instead of ponding against the masonry.</p></div>
     <div class="card rv" style="transition-delay:.3s"><h3>Furnace &amp; exhaust vents</h3><p>Gooseneck, furnace vent, Broan vent, exhaust wall vent — heat and fumes must leave the house.</p></div>
     <div class="card rv" style="transition-delay:.35s"><h3>Skylights &amp; sun tunnels</h3><p>Replace or re-flash at the same time as the roof. Flashing a 20-year-old skylight into a new roof is borrowing trouble.</p></div>
   </div>
   <div class="card edge rv" style="margin-top:26px;transition-delay:.32s"><span class="cap">Our standard</span>
     <p>When we replace a roof, <b>all flashings, boots, vents and drip edge are replaced</b> unless specified otherwise by the homeowner. Reusing old metal to save a hundred dollars is how a new roof leaks in year two.</p></div>`,
  `<div class="rv"><div class="eyebrow">Building Codes</div><h2 class="d2" style="margin-top:16px">Codes change. Your roof didn't.</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="rv">
       <p class="lead" style="margin-bottom:20px">Building codes are added or changed every couple of years — and the older your house is, the more out of date your roofing system is. Common code upgrades that apply to nearly every install:</p>
       <ul class="ticks">
         <li><b>Re-nail the decking</b> back to the rafters.</li>
         <li><b>Apply a secondary water barrier</b> (ice &amp; water at eaves and valleys).</li>
         <li><b>Seal the perimeter</b> and apply mastic around all open penetrations.</li>
         <li><b>Install kickout and rain diverters</b> at roof-to-wall junctions.</li>
         <li><b>Replace gutters</b> if they are spiked through the drip edge.</li>
         <li><b>Chimney crickets</b> where required to divert rainwater.</li>
       </ul>
     </div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="callout"><span class="cap">Why code language belongs on the estimate</span>
         <h3>"Code upgrade" isn't a sales word. It's a legal requirement.</h3>
         <p>Your municipality will not pass final inspection without these items, and your policy's law &amp; ordinance coverage exists to pay for them. When a carrier's first estimate leaves them off, that isn't a disagreement about quality — it's an incomplete estimate.</p></div>
       <div class="script rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">Rep talk track</span>
         <p>"If another bid is four thousand cheaper, ask them one question: is the deck re-nail and the ice barrier included, and will you pull the permit? Nine times out of ten that's the whole difference."</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Maintenance &amp; Warranty</div><h2 class="d2" style="margin-top:16px">Two warranties, not one.</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="card navyc rv"><span class="cap">Workmanship warranty</span>
       <div style="display:flex;gap:clamp(24px,4vw,48px);flex-wrap:wrap;margin-top:14px">
         <div><div class="bignum">15</div><div style="font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;color:#C9D5E9;font-weight:800;margin-top:10px">Year — Roofing</div></div>
         <div><div class="bignum">10</div><div style="font-size:.8rem;letter-spacing:.18em;text-transform:uppercase;color:#C9D5E9;font-weight:800;margin-top:10px">Year — Siding · Remodeling · Composite Decking</div></div>
       </div>
       <p style="margin-top:18px">On top of that, the manufacturer warranties the material itself. Two separate protections — labor and product.</p></div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="card"><span class="cap">Roof maintenance</span><h3>What keeps a roof at full life</h3>
         <ul class="ticks" style="margin-top:14px">
           <li>Keep gutters and valleys clear — standing debris holds water against the shingle.</li>
           <li>Trim overhanging limbs before the next wind event.</li>
           <li>Check pipe boots and sealant every few years.</li>
           <li>Have the roof inspected after any significant hail or wind storm — <b>free, whether or not you file</b>.</li>
         </ul></div>
       <table class="tbl rv" style="margin-top:20px;transition-delay:.2s">
         <tr><th>Coverage</th><th>Who stands behind it</th></tr>
         <tr><td>Material defect</td><td>Manufacturer — Atlas, LP, Mastic, CertainTeed, TimberTech</td></tr>
         <tr><td>Workmanship — roofing</td><td>{{COMPANY}} — <b>{{WARRANTY_ROOFING}} years</b></td></tr>
         <tr><td>Workmanship — siding, remodeling, decking</td><td>{{COMPANY}} — <b>{{WARRANTY_TRADES}} years</b></td></tr>
       </table>
     </div>
   </div>`
]},
{ id:'trades', tab:'Additional Trades', icon:'tools', title:'Additional Trades',
  blurb:'General contracting — siding, gutters, fascia, window wraps, A/C, interior, decks and fences.',
  slides:[
  `<div class="split">
     <div class="rv left">
       <div class="eyebrow">Section 06</div>
       <h1 class="d1" style="margin-top:18px">Additional<br><span class="serif gold">Trades</span></h1>
       <div class="rule"></div>
       <p class="lead">Usually when storms hit your property, other items besides the roof get damaged as well. No matter what the scope of loss is, we have crews who can handle all the work — so you don't have to deal with multiple companies.</p>
     </div>
     <div class="rv right" style="transition-delay:.15s">
       <div class="card navyc"><span class="cap">Why this matters on a claim</span><h3>Most homeowners under-claim by thousands.</h3>
         <p>They file for the roof and never mention the dented gutters, the cracked window wraps, the hail-bruised siding, the flattened A/C condenser fins or the water-stained ceiling. It's all part of the same loss — and we document all of it in one estimate.</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Exterior</div><h2 class="d2" style="margin-top:16px">Everything on the outside of your house</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="card rv"><span class="cap">Siding</span><h3>Vinyl &amp; engineered wood</h3><p><b>LP SmartSide</b> engineered wood, <b>Mastic</b> and <b>CertainTeed Monogram</b> vinyl. Hail cracks vinyl and dents aluminum — and if your profile is discontinued, that's a matching argument for full replacement.</p></div>
     <div class="card rv" style="transition-delay:.06s"><span class="cap">Gutters</span><h3>Seamless gutters &amp; downspouts</h3><p>5" and 6" seamless aluminum, formed on site. Oversized 6" is worth it on steep or large roof planes in this climate. Guards available.</p></div>
     <div class="card rv" style="transition-delay:.12s"><span class="cap">Trim</span><h3>Fascia &amp; soffit</h3><p>Aluminum-wrapped or composite fascia and vented soffit. This is where roof ventilation and exterior finish meet — one crew should do both.</p></div>
     <div class="card rv" style="transition-delay:.18s"><span class="cap">Openings</span><h3>Window wraps &amp; capping</h3><p>Aluminum capping over wood window and door trim. Hail dents it, water gets behind failed seams, and the wood rots underneath.</p></div>
     <div class="card rv" style="transition-delay:.24s"><span class="cap">Windows</span><h3>Replacement windows</h3><p>Full-frame and insert replacements in a range of styles and materials — energy efficiency plus a real upgrade to curb appeal.</p></div>
     <div class="card rv" style="transition-delay:.3s"><span class="cap">Paint</span><h3>Exterior painting</h3><p>Trim, soffit, fascia, doors and painted siding repainted to restore a uniform finish after repairs.</p></div>
     <div class="card rv" style="transition-delay:.36s"><span class="cap">Mechanical</span><h3>A/C condenser comb-out</h3><p>Hail flattens the aluminum fins on your condenser, choking airflow and driving up your cooling bill. Combing the fins straight is a legitimate, commonly-approved line item.</p></div>
     <div class="card rv" style="transition-delay:.42s"><span class="cap">Outdoor living</span><h3>Composite decking</h3><p><b>TimberTech</b> composite decks — the look of wood with none of the annual sanding, staining and splinters. 10-year workmanship warranty.</p></div>
     <div class="card rv" style="transition-delay:.48s"><span class="cap">Property</span><h3>Fences</h3><p>Wood, vinyl and aluminum fencing repaired or replaced. Wind damage to fencing is covered under most policies and routinely forgotten.</p></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Interior</div><h2 class="d2" style="margin-top:16px">When water gets inside</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="grid g2 rv" style="gap:18px">
       <div class="card"><span class="cap">Interior</span><h3>Drywall repair</h3><p>Cut out, replace, tape, mud and texture-match damaged ceilings and walls. Matching a knockdown or orange-peel texture is a craft — done wrong, the patch is visible forever.</p></div>
       <div class="card"><span class="cap">Interior</span><h3>Interior painting</h3><p>Prime and paint the repair, then carry it to a natural break so there's no halo. Full-room repaint where that's what it takes to match.</p></div>
       <div class="card"><span class="cap">Interior</span><h3>Insulation</h3><p>Wet insulation loses most of its R-value and never fully recovers. It gets removed and replaced — and it's a covered line item.</p></div>
       <div class="card"><span class="cap">Interior</span><h3>Trim, flooring &amp; remodeling</h3><p>Baseboard, casing, damaged flooring and full room remodels. 10-year workmanship warranty on remodeling.</p></div>
     </div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="callout"><span class="cap">One contractor</span><h3>You should not be the general contractor on your own house.</h3>
         <p>Coordinating a roofer, a siding company, a gutter installer, a window company, a drywall guy and a painter — while chasing an insurance adjuster — is a part-time job. We handle the scope, the sequence and the schedule under one agreement.</p></div>
       <div class="script rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">Rep talk track</span>
         <p>"Let's walk the whole property together before I write anything. I'd rather find the dent in your downspout and the crack in your window wrap today than have you find them after the claim is closed."</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Walk The Property</div><h2 class="d2" style="margin-top:16px">The storm damage checklist we run at every inspection</h2><div class="rule"></div></div>
   <div class="grid g4">
     <div class="card rv"><span class="cap">Roof plane</span>
       <ul class="ticks" style="margin-top:12px"><li>Shingle bruising, granule loss, creasing</li><li>Ridge cap &amp; hip damage</li><li>Vents, boots, skylights, flashing</li><li>Decking condition &amp; fastener pattern</li></ul></div>
     <div class="card rv" style="transition-delay:.08s"><span class="cap">Elevations</span>
       <ul class="ticks" style="margin-top:12px"><li>Siding cracks, chips and holes — all four sides</li><li>Window wraps, door capping, shutters</li><li>Fascia, soffit and gable vents</li><li>Screens, light fixtures, house numbers</li></ul></div>
     <div class="card rv" style="transition-delay:.16s"><span class="cap">Ground level</span>
       <ul class="ticks" style="margin-top:12px"><li>Gutters and downspouts — dents &amp; separations</li><li>A/C condenser fins &amp; disconnect box</li><li>Fence, deck, shed, detached garage</li><li>Mailbox, grill, patio furniture</li></ul></div>
     <div class="card rv" style="transition-delay:.24s"><span class="cap">Inside</span>
       <ul class="ticks" style="margin-top:12px"><li>Ceiling and wall staining</li><li>Attic — daylight, wet sheathing, matted insulation</li><li>Around chimneys and skylights</li><li>Basement and garage water intrusion</li></ul></div>
   </div>
   <div class="card edge rv" style="margin-top:26px;transition-delay:.28s"><span class="cap">Homeowner tip</span>
     <p>Take your own photos today with the date on them, and keep the receipts for any emergency repairs you paid for. Both are reimbursable and both strengthen your file.</p></div>`
]},
{ id:'commercial', tab:'Commercial Roofing', icon:'bldg', title:'Commercial Roofing',
  blurb:'Commercial division · claims · systems · spray foam &amp; coatings · maintenance · temporary repairs · mitigation.',
  slides:[
  `<div class="split">
     <div class="rv left">
       <div class="eyebrow">Section 07</div>
       <h1 class="d1" style="margin-top:18px">Commercial<br><span class="serif gold">Roofing</span></h1>
       <div class="rule"></div>
       <p class="lead">Commercial Division · Commercial Claims · Roofing Systems · References · Roof Maintenance · Temporary Repairs · Mitigation</p>
     </div>
     <div class="rv right" style="transition-delay:.15s">
       <div class="grid g2">
         <div class="card wash"><span class="cap">Capabilities</span><h3>Full-service commercial division</h3><p>New systems, restorations, coatings, spray foam, tear-offs, repairs, mitigation, temporary dry-in and scheduled maintenance programs.</p></div>
         <div class="card wash"><span class="cap">Claims</span><h3>Commercial claim support</h3><p>Large-loss documentation, moisture surveys, core cuts, code compliance, and coordination with property managers, ownership groups and carriers.</p></div>
       </div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Commercial Roofing Systems</div><h2 class="d2" style="margin-top:16px">Low-slope &amp; flat roof systems</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="card rv"><span class="cap">Single-ply</span><h3>TPO</h3><p>Heat-welded thermoplastic membrane. Highly reflective white surface reduces cooling load; seams are welded, not glued. The current default for new commercial construction.</p></div>
     <div class="card rv" style="transition-delay:.08s"><span class="cap">Single-ply</span><h3>EPDM</h3><p>Rubber membrane with a long service track record and excellent cold-weather flexibility — a real advantage in northern winters. Fully adhered, mechanically attached or ballasted.</p></div>
     <div class="card rv" style="transition-delay:.16s"><span class="cap">Single-ply</span><h3>PVC</h3><p>The choice where grease, chemicals or restaurant exhaust are in play. Superior chemical resistance with welded seams.</p></div>
     <div class="card rv" style="transition-delay:.24s"><span class="cap">Built-up</span><h3>Modified bitumen</h3><p>Multi-ply torch, cold-adhered or self-adhered systems. Redundant layers make it forgiving on roofs with heavy foot traffic.</p></div>
     <div class="card navyc rv" style="transition-delay:.32s"><span class="cap">Spray-applied</span><h3>SPF — spray foam</h3><p>Seamless, self-flashing, fully adhered insulation and waterproofing in a single application. Next slide.</p></div>
     <div class="card navyc rv" style="transition-delay:.4s"><span class="cap">Restoration</span><h3>Fluid-applied coatings</h3><p>Silicone, acrylic and polyurethane systems that renew an existing roof without a tear-off. Two slides ahead.</p></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Spray Foam</div><h2 class="d2" style="margin-top:16px">SPF — Spray Polyurethane Foam</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="rv">
       <p class="lead" style="margin-bottom:22px">Two liquid components mixed at the spray gun expand roughly thirty times on contact and cure in seconds into a rigid, closed-cell foam that is both the insulation and the waterproofing layer — with no seams anywhere on the roof.</p>
       <ul class="ticks">
         <li><b>Seamless and self-flashing.</b> It flows around curbs, drains, pipe penetrations and parapet walls. Seams are where flat roofs leak — SPF doesn't have any.</li>
         <li><b>The highest R-value per inch</b> of any common roof insulation, roughly R-6 to R-7 per inch. On a Chicago-area building that shows up on the utility bill every month.</li>
         <li><b>Adds almost no structural load</b> — typically under a pound per square foot — so it's often viable where a tear-off and re-cover isn't.</li>
         <li><b>Self-tapering.</b> Sprayed at varying thickness to build positive slope to the drains and eliminate ponding water without structural work.</li>
         <li><b>Renewable.</b> Recoat every 10–20 years and the system's life extends indefinitely. There is no tear-off in the future plan.</li>
       </ul>
     </div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="card navyc"><span class="cap">Best applications</span><h3>Where SPF wins</h3>
         <p>Roofs with heavy penetration density, irregular geometry, chronic ponding, or an existing roof that's dry and structurally sound but at the end of its surface life. Also strong where a building must stay fully operational — SPF goes over the existing roof with no tear-off, no dumpsters and no interior disruption.</p></div>
       <div class="card edge rv" style="margin-top:20px;transition-delay:.2s"><span class="cap">The honest limits</span>
         <p>SPF requires a dry substrate, the right temperature and humidity window, careful overspray containment, and a genuinely experienced applicator. It must always be topcoated — UV degrades exposed foam. If any of those conditions can't be met, we'll recommend a different system.</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Coatings</div><h2 class="d2" style="margin-top:16px">Roof coatings &amp; restoration systems</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="tier t2 rv"><div class="head">Silicone</div>
       <div class="body2"><p>The premium restoration coating and the standard topcoat over SPF.</p>
         <ul><li>Outstanding ponding-water resistance — it does not re-emulsify</li><li>Excellent UV stability, minimal erosion</li><li>Typically a single high-solids coat</li><li>Highly reflective — real cooling-load reduction</li></ul></div>
       <div class="foot">Best for ponding &amp; SPF topcoat</div></div>
     <div class="tier t1 rv" style="transition-delay:.1s"><div class="head">Acrylic</div>
       <div class="body2"><p>Water-based, economical, easy to apply and recoat.</p>
         <ul><li>Strong reflectivity, lowest material cost</li><li>Best on roofs that drain and dry quickly</li><li>Not the right choice where water sits</li><li>Needs a dry, above-freezing window</li></ul></div>
       <div class="foot">Budget restoration on well-drained roofs</div></div>
     <div class="tier t3 rv" style="transition-delay:.2s"><div class="head">Polyurethane</div>
       <div class="body2"><p>The toughest of the three under physical abuse.</p>
         <ul><li>Superior impact and foot-traffic resistance</li><li>Aromatic base + aliphatic topcoat systems</li><li>Excellent around rooftop equipment and walkways</li><li>Often hybridized with silicone</li></ul></div>
       <div class="foot">High-traffic &amp; equipment-heavy roofs</div></div>
   </div>
   <div class="grid g2 rv" style="margin-top:26px;transition-delay:.24s">
     <div class="callout"><span class="cap">Why owners choose restoration</span><h3>No tear-off. No disruption.</h3>
       <p>A coating restoration typically costs a fraction of a full replacement, keeps thousands of pounds of old roofing out of a landfill, and lets the building operate normally throughout. Many restoration systems carry renewable manufacturer warranties, and because they can often be treated as maintenance rather than a capital improvement, the accounting can be more favorable — confirm with your CPA.</p></div>
     <div class="card edge"><span class="cap">Restoration checklist</span>
       <ul class="ticks" style="margin-top:14px">
         <li>Moisture survey — wet insulation must come out first</li>
         <li>Core cuts to confirm the existing assembly</li>
         <li>Seam, flashing and penetration repair</li>
         <li>Power wash and prime as the substrate requires</li>
         <li>Reinforce all seams and details with fabric</li>
         <li>Apply at manufacturer-specified mil thickness</li>
       </ul></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Maintenance · Temporary Repairs · Mitigation</div><h2 class="d2" style="margin-top:16px">Keeping the building open</h2><div class="rule"></div></div>
   <div class="grid g3">
     <div class="card rv"><span class="cap">Program</span><h3>Scheduled roof maintenance</h3><p>Semi-annual inspection, drain and gutter clearing, seam and flashing check, sealant renewal, and a written condition report with photos. Most commercial warranties require documented maintenance to stay valid.</p></div>
     <div class="card rv" style="transition-delay:.1s"><span class="cap">Emergency</span><h3>Temporary repairs &amp; dry-in</h3><p>Immediate leak response to stop water entry, protect inventory and limit interior damage while the permanent scope and the claim are worked out.</p></div>
     <div class="card rv" style="transition-delay:.2s"><span class="cap">Mitigation</span><h3>Limiting the loss</h3><p>Water extraction, containment, drying and protection of contents. Carriers expect the insured to take reasonable steps to prevent further damage — documented mitigation strengthens a claim rather than weakening it.</p></div>
   </div>
   <div class="stats rv" style="margin-top:26px;transition-delay:.24s">
     <div class="stat"><div class="v">R-6<span style="font-size:.5em">+</span></div><div class="l">R-value per inch, closed-cell SPF</div></div>
     <div class="stat"><div class="v" data-count="0">0</div><div class="l">Seams in a sprayed foam roof</div></div>
     <div class="stat"><div class="v">10–20</div><div class="l">Years between coating renewals</div></div>
     <div class="stat"><div class="v" data-count="2" data-suffix="&times;">0</div><div class="l">Recommended inspections per year</div></div>
   </div>`
]},
{ id:'financing', tab:'Financing', icon:'cash', title:'Financing & Investment',
  blurb:'What you actually pay, service financing, and bridging the gap while you wait on funds.',
  slides:[
  `<div class="split">
     <div class="rv left">
       <div class="eyebrow">Section 08</div>
       <h1 class="d1" style="margin-top:18px">Financing &amp;<br><span class="serif gold">Investment</span></h1>
       <div class="rule"></div>
       <p class="lead">On an approved storm claim, most homeowners' out-of-pocket cost is their deductible. Here's exactly how the money moves — and what your options are if you're paying out of pocket.</p>
     </div>
     <div class="rv right" style="transition-delay:.15s">
       <div class="card navyc"><span class="cap">Straight answer</span><h3>Your deductible is your cost.</h3>
         <p>Any contractor who offers to "cover," "eat," "waive" or "work around" your deductible is describing insurance fraud, and it puts your claim and your policy at risk. We will never make that offer.</p></div>
     </div>
   </div>`,
  `<div class="rv"><div class="eyebrow">The Money Flow</div><h2 class="d2" style="margin-top:16px">How an approved claim actually pays out</h2><div class="rule"></div></div>
   <div class="flow">
     <div class="step rv"><div class="n">1</div><h4>Claim approved</h4><p>The carrier issues a settlement summary showing RCV, depreciation, deductible and net ACV.</p></div>
     <div class="step rv" style="transition-delay:.08s"><div class="n">2</div><h4>First check — ACV</h4><p>Replacement cost minus depreciation minus your deductible, issued in your name. With a mortgage, your lender is likely named too.</p></div>
     <div class="step rv" style="transition-delay:.16s"><div class="n">3</div><h4>Mortgage endorsement</h4><p>Your lender's loss-draft department endorses the check, often in stages tied to inspections. We walk you through it.</p></div>
     <div class="step rv" style="transition-delay:.24s"><div class="n">4</div><h4>Work completed</h4><p>The full approved scope is built to code and passes the village final inspection.</p></div>
     <div class="step rv" style="transition-delay:.32s"><div class="n">5</div><h4>Final invoice submitted</h4><p>Invoices and completion photos go to the carrier proving the work was done as scoped.</p></div>
     <div class="step rv" style="transition-delay:.4s"><div class="n">6</div><h4>Depreciation released</h4><p>The recoverable depreciation is paid out. Your total out of pocket ends up being your deductible plus any upgrades you chose.</p></div>
   </div>
   <div class="grid g2 rv" style="margin-top:26px;transition-delay:.32s">
     <div class="card edge"><span class="cap">What can add to your cost</span>
       <ul class="ticks" style="margin-top:14px">
         <li><b>Upgrades you choose</b> — Class 4 impact shingles, a metal roof, premium ridge, upgraded gutters.</li>
         <li><b>Non-storm items</b> you decide to fix while the crew is already there.</li>
         <li><b>Non-recoverable depreciation</b>, if you carry an ACV-only policy rather than RCV.</li>
       </ul></div>
     <div class="script"><span class="cap">Rep talk track</span>
       <p>"Let's look at your declarations page together. Two lines matter: whether you're RCV or ACV, and whether your deductible is a flat dollar amount or a percentage of the dwelling value. Those two lines determine your entire out-of-pocket number."</p></div>
   </div>`,
  `<div class="rv"><div class="eyebrow">Service Financing</div><h2 class="d2" style="margin-top:16px">Options if you're not filing a claim</h2><div class="rule"></div></div>
   <div class="grid g2">
     <div class="rv"><ul class="ticks">
       <li><b>We partner with multiple lenders</b> to offer competitive financing — whether your credit is excellent or challenged.</li>
       <li><b>Bridge financing</b> when the job is complete but the carrier hasn't yet released the recoverable depreciation, so your house isn't waiting on a check.</li>
       <li><b>Aging roof, no storm?</b> Carriers increasingly non-renew or surcharge policies on older roofs. Replacing proactively is frequently cheaper than the premium increase or the forced placement that follows a non-renewal.</li>
       <li><b>Class 4 impact discount.</b> Many carriers offer a premium credit for a UL 2218 Class 4 roof. Over a fifteen-year hold, that credit can offset a meaningful share of the upgrade cost.</li>
     </ul>
     <div class="card edge rv" style="margin-top:22px;transition-delay:.18s"><span class="cap">Note</span>
       <p>Financing is offered through third-party lenders; approval, rates and terms are set by the lender and depend on credit. We are contractors — not lenders, financial advisors or insurance agents. Confirm premium credits with your agent and financing terms with the lender.</p></div>
     </div>
     <div class="rv right" style="transition-delay:.12s">
       <div class="callout"><span class="cap">The expensive roof</span><h3>The most expensive roof is the one you buy twice.</h3>
         <p>A cheap install that fails in year seven costs more than the right system installed once. Between the second tear-off, the interior damage in the meantime, and the claim you can no longer file, "saving" four thousand dollars up front routinely costs three times that.</p></div>
       <table class="tbl rv" style="margin-top:20px;transition-delay:.2s">
         <tr><th>Coverage</th><th>Who stands behind it</th></tr>
         <tr><td>Material defect</td><td>Manufacturer</td></tr>
         <tr><td>Workmanship — roofing</td><td>{{COMPANY}} — <b>{{WARRANTY_ROOFING}} years</b></td></tr>
         <tr><td>Workmanship — siding, remodeling, decking</td><td>{{COMPANY}} — <b>{{WARRANTY_TRADES}} years</b></td></tr>
       </table>
     </div>
   </div>`
]}
];
