/* Markup ported verbatim from gcn_landing_reference.html (header/footer excluded). */

export const REF_VIEWS: Record<string, string> = {
  home: `
  <div class="hero">
    <div class="wrap">
      <div class="hero-grid">
        <div class="stack g28">
          <div class="logo-wrap rv"><img class="logo-anim" id="logoAnim"
            alt="Claim Buddy — powered by Global Contractor Network"></div>
          <span class="micro rv">Insurance restoration · roof, exterior &amp; interior</span>
          <h1 id="heroH">Measure the roof before you knock on the door.</h1>
          <p class="lead rv">Type an address and the roof traces itself. Then walk it — roof, all four
            exterior elevations, and the interior — and hand the homeowner a carrier-ready scope
            before you leave the driveway.</p>
          <div class="row rv">
            <button class="btn btn-p btn-lg pulse" data-go="signup"><span>Book a demo</span><i class="spec"></i></button>
            <button class="btn btn-s btn-lg" data-v="product"><span>See every screen</span><i class="spec"></i></button>
          </div>
          <div class="hero-stats rv">
            <div class="s"><div class="v mono" id="sqv">0.0</div><div class="l">Squares</div></div>
            <div class="s"><div class="v mono">4:12</div><div class="l">Pitch</div></div>
            <div class="s"><div class="v mono">18</div><div class="l">Scope items</div></div>
          </div>
          <p class="tiny rv" style="color:#7f8f88">Runs in the phone browser at gcn.claims. No app store, no install.</p>
        </div>

        <div class="stage rv">
          <div class="fan" id="fan">
            <div class="glowdot"></div>
            <div class="ph p1"><img data-shot="wideshots" alt="Elevation wide shots screen"></div>
            <div class="ph p2"><img data-shot="m3_footprint" alt="Traced roof footprint with draggable corners"></div>
            <div class="ph p3"><img data-shot="rb_cover" alt="Damage report cover page"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- marquee of real screens -->
  <div class="sec" style="padding-top:38px;padding-bottom:8px">
    <div class="wrap"><div class="dim rv"><span>Real screens · not mockups</span></div></div>
  </div>
  <div class="marquee rv" id="marq"><div class="marquee-t" id="marqT"></div></div>


  <!-- watch it measure -->
  <div class="sec" style="padding-bottom:0">
    <div class="wrap stack g28">
      <div class="dim rv"><span>Address to labeled roof</span></div>
      <div class="grid g2" style="gap:44px;align-items:center">
        <div class="stack g20 rv">
          <h2>Seven taps, and the roof is measured.</h2>
          <p class="lead" style="font-size:1rem">This is the real thing, frame by frame — pin, trace,
            drag the corners onto the actual roof, draw the ridges and hips, label each edge. Squares
            and linear footage update the whole way through.</p>
          <div class="row"><span class="chip">One outline per structure</span>
            <span class="chip">Drag any corner</span><span class="chip">Draw by hand too</span>
            <span class="chip">Every edge gets a type</span></div>
          <div class="row" style="margin-top:6px">
            <button class="btn btn-p btn-lg pulse" data-go="signup"><span>Measure your address on a call</span><i class="spec"></i></button>
          </div>
        </div>
        <div class="stage"><div class="rv-3d">
          <div class="dev tilt" style="max-width:340px">
            <div class="scr player" id="playHome"></div>
          </div>
          <div style="max-width:340px;margin:0 auto" id="playHomeUI"></div>
        </div></div>
      </div>
    </div>
  </div>

  <!-- five steps -->
  <div class="sec">
    <div class="wrap stack g28">
      <div class="dim rv"><span>What happens on site</span></div>
      <div class="steps rv-3d" id="steps"></div>
    </div>
  </div>

  <!-- three inspections -->
  <div class="sec" style="padding-top:0">
    <div class="wrap stack g28">
      <div class="dim rv"><span>Three inspections, one job</span></div>
      <div class="stack g12 rv">
        <h2>The roof was never the whole claim.</h2>
        <p class="lead">A hail event does not stop at the shingles. Claim Buddy captures the roof,
          every exterior elevation, and the interior in the same job — and the report prints all three,
          including what you chose not to inspect.</p>
      </div>
      <div class="insp">
        <div class="i rv-3d">
          <span class="chip chip-a">Roof</span>
          <h3 style="margin:14px 0 8px">Slopes, hardware, damage</h3>
          <ul>
            <li>Roof system, decking, layers and pitch</li>
            <li>Flashing, ventilation, penetrations, skylights, solar</li>
            <li>Gutters, downspouts, guards and roof hardware</li>
            <li>Test squares, hits per square, damage close-ups</li>
          </ul>
        </div>
        <div class="i rv-3d">
          <span class="chip chip-a">Exterior — 4 elevations</span>
          <h3 style="margin:14px 0 8px">Front, right, rear, left</h3>
          <ul>
            <li>Siding, soffit, fascia and wraps</li>
            <li>Window screens, wraps and trim</li>
            <li>Garage door, entry doors, light fixtures</li>
            <li>A/C fins, fence, pool cage and screens</li>
          </ul>
        </div>
        <div class="i warn rv-3d">
          <span class="chip chip-w">Interior</span>
          <h3 style="margin:14px 0 8px">Room by room, or marked N/A</h3>
          <ul>
            <li>Ceilings, walls, water staining by room</li>
            <li>Insulation, decking from the attic side</li>
            <li>Moisture readings and affected finishes</li>
            <li>Skip it and the report prints <b>Not inspected</b> — never a blank</li>
          </ul>
        </div>
      </div>
      <div class="grid g2 rv" style="align-items:center;margin-top:14px">
        <div class="stack g16">
          <h3>One progress list covers all three.</h3>
          <p class="lead" style="font-size:1rem">Roof system through roof notes, then left, rear, front
            and right exterior takeoffs, then the interior. The percentage at the top is the whole job,
            not just the roof — so nobody creates a report with a quarter of it missing.</p>
          <div class="row"><span class="chip">Gaps flagged in amber</span><span class="chip">Nothing blocks the report</span></div>
        </div>
        <div class="dev tilt rv-3d"><div class="scr"><img data-shot="progress" alt="Takeoff progress screen showing roof, exterior and interior sections"></div></div>
      </div>
    </div>
  </div>


  <!-- the gap -->
  <div class="sec" style="padding-top:0">
    <div class="wrap stack g28">
      <div class="dim rv"><span>Why the documentation matters</span></div>
      <div class="grid g2" style="gap:44px;align-items:center">
        <div class="stack g20 rv">
          <h2>The first estimate is not the claim.</h2>
          <p class="lead" style="font-size:1rem">A carrier writes the roof from a twenty-minute walk —
            tear-off, felt, starter, shingles, ridge, a few vents. A documented scope carries every code
            item, every flashing, the gutters, the debris haul and the detach-and-reset work that first
            estimate left off.</p>
          <div class="grid g2" style="gap:14px">
            <div class="card elev-card" style="padding:18px">
              <span class="micro">Carrier's first estimate</span>
              <div class="tile-v" style="font-size:26px;color:var(--text-muted)">$29,516</div>
              <div class="tile-h">Roof only.</div>
            </div>
            <div class="card elev-card tile" style="padding:18px;border-color:color-mix(in srgb,var(--accent) 45%,transparent)">
              <span class="micro">Documented line-item scope</span>
              <div class="tile-v" style="font-size:26px;color:var(--accent)">$40,241</div>
              <div class="tile-h">Same roof, complete.</div>
            </div>
          </div>
          <p class="tiny">A 36% difference — documented, submitted and approved as a supplement rather
            than negotiated. Illustrative example based on a typical supplemented storm claim.</p>
        </div>
        <div class="stage"><div class="dev tilt rv-3d" style="max-width:330px">
          <div class="scr"><img data-shot="pr_gap" alt="Presentation slide comparing the carrier's first estimate to a documented line-item estimate"></div>
        </div></div>
      </div>
    </div>
  </div>

  <!-- why switch -->
  <div class="sec" style="padding-top:0">
    <div class="wrap stack g28">
      <div class="dim rv"><span>Why reps switch</span></div>
      <div class="grid g3">
        <div class="card elev-card tile rv-3d">
          <span class="micro">Measure</span>
          <div class="tile-v">~10s</div>
          <div class="tile-h">Address to traced footprint. One outline, then you drag the corners onto the real ones.</div>
        </div>
        <div class="card elev-card tile rv-3d">
          <span class="micro">Re-keying</span>
          <div class="tile-v">0×</div>
          <div class="tile-h">Quantities flow measurement → takeoff → estimate → report. Nothing gets typed twice.</div>
        </div>
        <div class="card elev-card tile rv-3d">
          <span class="micro">Leave with</span>
          <div class="tile-v">4 docs</div>
          <div class="tile-h">Damage report, photo appendix, priced estimate and a signed contingency.</div>
        </div>
      </div>
      <blockquote class="card elev-raised rv" style="border-left:3px solid var(--accent);padding:28px 30px">
        <p class="serif" style="font-size:clamp(1.25rem,2.3vw,1.7rem);line-height:1.35;letter-spacing:-.01em">
          The rep who documents the whole loss on the first visit does not go back for photos,
          and does not negotiate from a scope the carrier wrote.</p>
      </blockquote>
    </div>
  </div>

  <!-- about -->
  <div class="sec" style="padding-top:0">
    <div class="wrap">
      <div class="grid g2" style="gap:44px;align-items:start">
        <div class="stack g20 rv">
          <div class="dim" style="justify-content:flex-start"><span>About</span></div>
          <h2>Built by a roofer, on real claims.</h2>
          <p class="lead" style="font-size:1rem">Claim Buddy comes out of Global Contractor Network — a
            Florida restoration contractor, not a software company that interviewed one. Every screen
            in it started as a step someone was doing badly on a clipboard or twice in two systems.</p>
          <p class="lead" style="font-size:1rem">It runs at <b>gcn.claims</b> in the phone browser, because
            that is where the work happens. The same engine powers the full job workflow on
            globalcontractor.app when a company grows into it.</p>
          <div class="row"><span class="chip">Boca Raton, Florida</span><span class="chip">Florida code items</span><span class="chip">Carrier-format estimates</span></div>
        </div>
        <div class="grid g2 rv-3d" style="gap:14px">
          <div class="card elev-card" style="padding:18px"><span class="micro">Inspections run</span><div class="tile-v" style="font-size:24px">1,400+</div></div>
          <div class="card elev-card" style="padding:18px"><span class="micro">Avg squares</span><div class="tile-v" style="font-size:24px">32.6</div></div>
          <div class="card elev-card" style="padding:18px"><span class="micro">Trades covered</span><div class="tile-v" style="font-size:24px">8</div></div>
          <div class="card elev-card" style="padding:18px"><span class="micro">Report pages</span><div class="tile-v" style="font-size:24px">14–40</div></div>
        </div>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div class="sec" style="padding-top:0">
    <div class="wrap">
      <div class="card elev-float rv-3d" style="padding:clamp(30px,5vw,54px);text-align:center;overflow:hidden;position:relative">
        <div style="position:absolute;inset:auto auto -55% 50%;transform:translateX(-50%);width:640px;height:400px;
          background:radial-gradient(circle,rgba(var(--accent-rgb),.18),transparent 66%);pointer-events:none"></div>
        <div class="stack g20" style="align-items:center;position:relative">
          <span class="micro">Fifteen minutes, your address</span>
          <h2 style="max-width:20ch">We measure a roof you know on the call.</h2>
          <p class="lead" style="text-align:center">Bring a house you have already inspected. If the
            numbers do not hold up against what you measured by hand, we have not earned the next call.</p>
          <div class="row" style="justify-content:center">
            <button class="btn btn-p btn-lg pulse" data-go="signup"><span>Book a demo</span><i class="spec"></i></button>
            <button class="btn btn-s btn-lg" data-v="pricing"><span>See pricing</span><i class="spec"></i></button>
          </div>
        </div>
      </div>
    </div>
  </div>`,
  product: `  <div class="sec">
    <div class="wrap stack g28">
      <div class="stack g12 rv">
        <span class="micro">Live preview</span>
        <h1>Every screen a rep touches.</h1>
        <p class="lead">Real screenshots from the app running at gcn.claims. Pick a step to walk through it.</p>
      </div>
      <div class="tabs rv" id="tabs" role="tablist"></div>
      <div class="dim rv"><span id="paneLbl">Measure</span></div>
      <div class="grid g2" id="pane" style="gap:40px;align-items:center"></div>
    </div>
  </div>

  <div class="sec" style="padding-top:0">
    <div class="wrap stack g28">
      <div class="dim rv"><span>The whole workflow</span></div>
      <div class="grid g3" id="allShots"></div>
    </div>
  </div>`,
  gallery: `  <div class="sec">
    <div class="wrap stack g28">
      <div class="stack g12 rv">
        <span class="micro">Photo gallery</span>
        <h1>Fifty-eight real screens.</h1>
        <p class="lead">Every one captured on a phone at gcn.claims during an actual inspection.
          Tap any of them to open it full size.</p>
      </div>
      <div class="tabs rv" id="gfilter" style="margin-bottom:4px"></div>
      <div class="grid g4" id="gal"></div>
    </div>
  </div>`,
  pricing: `  <div class="sec">
    <div class="wrap stack g40">
      <div class="stack g12 rv">
        <span class="micro">Pricing</span>
        <h1>Three plans. Cancel any time.</h1>
        <p class="lead">Priced against what you already spend. One Xactimate license runs $150–250 a
          month. A supplement service takes 15–25% of everything it recovers.</p>
      </div>

      <div class="grid g3">
        <div class="plan rv-3d">
          <span class="micro">Tier 1</span>
          <h3 style="font-size:1.3rem">Basic</h3>
          <div class="price">$19.99<small> /user /mo</small></div>
          <ul class="ticks">
            <li>The full inspection workflow, start to finish</li>
            <li>Polygon draw measurements — trace the roof by hand</li>
            <li>Roof takeoff — every hardware category</li>
            <li>Exterior takeoff, all four elevations</li>
            <li>Interior takeoff, room by room</li>
            <li>Photo documentation by elevation</li>
            <li>Damage report and photo appendix PDF</li>
            <li>Homeowner presentation — nine sections</li>
            <li>Estimates you build yourself — description, unit, quantity, price</li>
            <li>Your own retail price-per-square macro</li>
            <li>Contingency or retail agreement, e-signed</li>
            <li>Billed per user — add or remove users any time</li>
            <li>No AI measurement, Survival Guide, Storm Intel or price book</li>
          </ul>
          <button class="btn btn-s btn-block" data-go="checkout" data-plan="Basic" data-amt="19.99" data-base="0" data-inc="0" data-rate="19.99"><span>Start free trial</span><i class="spec"></i></button>
        </div>

        <div class="plan best rv-3d">
          <span class="chip chip-a" style="align-self:flex-start">Most chosen</span>
          <span class="micro">Tier 2</span>
          <h3 style="font-size:1.3rem">Pro</h3>
          <div class="price">$120<small> /mo · 3 seats</small></div>
          <ul class="ticks">
            <li>Everything in Basic — 3 seats included, $30/mo per extra seat</li>
            <li>AI instant roof measurement — one pin, traced for you</li>
            <li>Facet, edge and pitch detection with editable corners</li>
            <li>The Blue Collar Sales Survival Guide</li>
            <li>Scripts, rebuttals and the 7-day new rep ramp</li>
          </ul>
          <button class="btn btn-p btn-block" data-go="checkout" data-plan="Pro" data-amt="120" data-base="120" data-inc="3" data-rate="30"><span>Start free trial</span><i class="spec"></i></button>
        </div>

        <div class="plan rv-3d">
          <span class="micro">Tier 3</span>
          <h3 style="font-size:1.3rem">Elite</h3>
          <div class="price">$200<small> /mo · 3 seats</small></div>
          <ul class="ticks">
            <li>Everything in Pro — company setup, 3 seats included, $40/mo per extra seat</li>
            <li>The price book for your market, assigned to your company</li>
            <li>Line-item estimates with real codes and waste math</li>
            <li>Carrier-format estimate export</li>
            <li>Storm Intel hail and wind maps</li>
            <li>Canvassing map with storm history on every property</li>
          </ul>
          <button class="btn btn-s btn-block" data-go="checkout" data-plan="Elite" data-amt="200" data-base="200" data-inc="3" data-rate="40"><span>Start free trial</span><i class="spec"></i></button>
        </div>
      </div>

      <div class="stack g16">
        <div class="dim rv"><span>Seat pricing</span></div>
        <div class="tw rv">
          <table>
            <thead><tr><th>Seats</th><th>Basic</th><th>Pro</th><th>Elite</th><th>Notes</th></tr></thead>
            <tbody class="mono" id="bands"></tbody>
          </table>
        </div>
        <p class="tiny rv">Billed monthly. Basic is $19.99 per user. Pro and Elite include 3 seats — extra seats are $30 and $40 per month. Add or remove seats any time, prorated.</p>
      </div>

      <div class="grid g3">
        <div class="card elev-card rv"><h3>Cancel any time</h3><p class="tiny" style="margin-top:8px">One click in the admin panel. No phone call, no retention queue, no notice period.</p></div>
        <div class="card elev-card rv"><h3>Your data leaves with you</h3><p class="tiny" style="margin-top:8px">Export every inspection, photo, report and estimate on the way out. It was never hostage.</p></div>
        <div class="card elev-card rv"><h3>14 days free</h3><p class="tiny" style="margin-top:8px">No charge on day one. We remind you two days before the trial ends.</p></div>
      </div>
    </div>
  </div>`,
  resources: `  <div class="sec">
    <div class="wrap stack g28">
      <div class="stack g12 rv">
        <span class="micro">Resources</span>
        <h1>A green rep to first close in seven days.</h1>
        <p class="lead">Training is not a PDF nobody opens. It ships inside the app your reps already
          have on their phone — scripts, rebuttals, insurance language and closes, searchable from the
          driveway.</p>
      </div>

      <!-- survival guide feature -->
      <div class="grid g2 rv" style="gap:44px;align-items:center;margin-top:10px">
        <div class="stack g20">
          <div class="row"><span class="chip chip-a">Included in Pro and Elite</span></div>
          <h2 style="font-size:clamp(1.5rem,2.6vw,2.1rem)">The Blue Collar Sales Survival Guide</h2>
          <p class="lead" style="font-size:1rem">A living workspace, not a course. Reps search it mid-conversation
            — at the door, on the roof, at the kitchen table — and add their own field notes back into it
            so the next rep gets what they learned.</p>
          <div class="grid g2" style="gap:12px">
            <div class="card elev-card" style="padding:16px"><span class="micro">Section 01</span>
              <h3 style="margin-top:7px;font-size:1rem">The Philosophy</h3>
              <p class="tiny" style="margin-top:5px">Why the job is service, not persuasion — and how that changes the conversation.</p></div>
            <div class="card elev-card" style="padding:16px"><span class="micro">Section 02</span>
              <h3 style="margin-top:7px;font-size:1rem">Trainer Cheat Sheets</h3>
              <p class="tiny" style="margin-top:5px">One-page pulls a manager can hand a rep in the truck before a knock.</p></div>
            <div class="card elev-card" style="padding:16px"><span class="micro">Section 03</span>
              <h3 style="margin-top:7px;font-size:1rem">New Rep 7-Day Ramp</h3>
              <p class="tiny" style="margin-top:5px">A week-by-week plan to take a green rep to first close. Steal it, modify it, run it.</p></div>
            <div class="card elev-card" style="padding:16px"><span class="micro">Always on</span>
              <h3 style="margin-top:7px;font-size:1rem">Field Notes</h3>
              <p class="tiny" style="margin-top:5px">What actually worked, added by the rep who used it, searchable by everyone after.</p></div>
          </div>
          <div class="row"><span class="chip">Scripts</span><span class="chip">Rebuttals</span>
            <span class="chip">Insurance language</span><span class="chip">Closes</span></div>
        </div>
        <div class="stage"><div class="dev tilt rv-3d" style="max-width:330px">
          <div class="scr"><img data-shot="survival" alt="The Blue Collar Sales Survival Guide inside the app, showing the New Rep 7-Day Ramp"></div>
        </div></div>
      </div>

      <div class="dim rv" style="margin-top:14px"><span>The 7-day ramp</span></div>
      <div class="grid g4" id="ramp"></div>

      <div class="dim rv" style="margin-top:20px"><span>Training videos</span></div>
      <div class="grid g3" id="vids"></div>

      <div class="dim rv" style="margin-top:20px"><span>Also included</span></div>
      <div class="grid g4">
        <div class="card elev-card rv"><h3>Inspection checklist</h3><p class="tiny" style="margin-top:8px">Printable, one page — roof, exterior and interior.</p></div>
        <div class="card elev-card rv"><h3>Florida code sheet</h3><p class="tiny" style="margin-top:8px">The code items adjusters ask you to justify, with citations.</p></div>
        <div class="card elev-card rv"><h3>Objection scripts</h3><p class="tiny" style="margin-top:8px">What to say at the door, on the roof and at the table.</p></div>
        <div class="card elev-card rv"><h3>Onboarding call</h3><p class="tiny" style="margin-top:8px">45 minutes with your team, price book loaded before you start.</p></div>
      </div>
    </div>
  </div>`,
  blog: `  <div class="sec">
    <div class="wrap stack g28">
      <div class="stack g12 rv">
        <span class="micro">Field notes</span>
        <h1>What we learn on roofs.</h1>
        <p class="lead">Written from claims we actually ran. No listicles.</p>
      </div>
      <div class="grid g3" id="posts"></div>
    </div>
  </div>`,
  admin: `  <div class="sec">
    <div class="wrap stack g28">
      <div class="stack g12 rv">
        <span class="micro">Master login · owner only</span>
        <h1>Publishing dashboard.</h1>
        <p class="lead">Draft a post, or let it write and schedule the week from a topic and a target keyword.</p>
      </div>
      <div class="grid g2" style="align-items:start;gap:24px">
        <div class="card elev-raised rv-3d">
          <h3>Auto-post</h3>
          <div class="stack g16" style="margin-top:18px">
            <label class="f">Topic<input class="inp" id="apTopic" value="Why 95% of storm claims need a supplement"></label>
            <div class="grid g2" style="gap:14px">
              <label class="f">Target keyword<input class="inp" value="roof supplement"></label>
              <label class="f">Cadence<select class="inp"><option>Weekly</option><option>Twice weekly</option><option>Daily</option></select></label>
            </div>
            <label class="f">Voice<select class="inp"><option>Plain-spoken contractor</option><option>Technical, adjuster-facing</option><option>Homeowner-friendly</option></select></label>
            <label class="f">Include<select class="inp"><option>Photos from recent inspections</option><option>Text only</option><option>Photos + estimate excerpt</option></select></label>
            <div class="row">
              <button class="btn btn-p" id="genBtn"><span>Generate &amp; schedule</span><i class="spec"></i></button>
              <button class="btn btn-g"><span>Save draft</span></button>
            </div>
          </div>
        </div>
        <div class="card elev-raised rv-3d">
          <h3>Queue</h3>
          <div class="tw" style="margin-top:18px;box-shadow:none;border-radius:12px">
            <table>
              <thead><tr><th>Post</th><th>Status</th><th>Goes out</th></tr></thead>
              <tbody id="queue"></tbody>
            </table>
          </div>
          <div class="dim" style="margin:22px 0 16px"><span>This month</span></div>
          <div class="grid g3" style="gap:12px">
            <div><div class="tile-v" style="font-size:22px">4</div><div class="tile-h">Published</div></div>
            <div><div class="tile-v" style="font-size:22px">1,284</div><div class="tile-h">Reads</div></div>
            <div><div class="tile-v" style="font-size:22px">19</div><div class="tile-h">Demos booked</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>`,
  signup: `  <div class="sec">
    <div class="wrap">
      <div class="grid g2" style="gap:44px;align-items:start">
        <div class="card elev-raised rv-3d">
          <span class="micro">Book a demo</span>
          <h2 style="font-size:1.7rem;margin:10px 0 6px">Fifteen minutes.</h2>
          <p class="tiny">Bring an address you already know. We measure it live.</p>
          <div class="stack g16" style="margin-top:22px">
            <div class="grid g2" style="gap:14px">
              <label class="f">Name<input class="inp" placeholder="Jared Janacek"></label>
              <label class="f">Company<input class="inp" placeholder="Global Contractor Network"></label>
            </div>
            <div class="grid g2" style="gap:14px">
              <label class="f">Work email<input class="inp" type="email" placeholder="you@company.com"></label>
              <label class="f">Mobile<input class="inp" type="tel" placeholder="(555) 010-0100"></label>
            </div>
            <div class="grid g2" style="gap:14px">
              <label class="f">Field reps<select class="inp"><option>1–3</option><option selected>4–10</option><option>11–50</option><option>51+</option></select></label>
              <label class="f">Address to measure<input class="inp" placeholder="15200 Rodeo Dr"></label>
            </div>
            <button class="btn btn-p btn-lg btn-block pulse" data-go="done"><span>Book my demo</span><i class="spec"></i></button>
            <p class="tiny">No card. We do not sell your information, and one person calls you — not a sequence of five.</p>
          </div>
        </div>

        <div class="stack g20">
          <div class="dim rv" style="justify-content:flex-start"><span>What happens after you book</span></div>
          <p class="lead rv" style="font-size:.98rem">Every message below is drafted by the assistant from
            your call notes, then read by a person before it sends. Nothing goes out unread, and one
            reply stops the whole sequence.</p>
          <div class="stack g12" id="seq"></div>
        </div>
      </div>
    </div>
  </div>`,
  signin: `  <div class="sec">
    <div class="wrap" style="max-width:440px">
      <div class="card elev-float rv-3d">
        <div class="stack g16" style="align-items:center;text-align:center">
          <span class="mk" style="width:44px;height:44px;border-radius:13px;display:grid;place-items:center;color:#fff;
            font-family:var(--font-mono);font-weight:800;font-size:.85rem;
            background:linear-gradient(160deg,var(--accent-bright),var(--accent-deep));box-shadow:var(--glow)">CB</span>
          <h2 style="font-size:1.6rem">Welcome back</h2>
          <p class="tiny">Sign in to gcn.claims</p>
        </div>
        <div class="stack g16" style="margin-top:24px">
          <label class="f">Email<input class="inp" type="email" placeholder="you@company.com"></label>
          <label class="f">Password<input class="inp" type="password" placeholder="••••••••"></label>
          <button class="btn btn-p btn-lg btn-block"><span>Sign in</span><i class="spec"></i></button>
          <p class="tiny" style="text-align:center">No account yet?
            <a data-go="signup" style="cursor:pointer">Book a demo</a></p>
        </div>
      </div>
    </div>
  </div>`,
  checkout: `  <div class="sec">
    <div class="wrap stack g28">
      <div class="stack g12 rv">
        <span class="micro">Checkout</span>
        <h1>Start your trial.</h1>
        <p class="lead">Fourteen days free. We remind you two days before it ends, and you can cancel
          in one click until then.</p>
      </div>
      <div class="grid g2" style="gap:26px;align-items:start">
        <div class="card elev-raised rv-3d">
          <h3>Billing</h3>
          <div class="stack g16" style="margin-top:18px">
            <label class="f">Name on card<input class="inp"></label>
            <label class="f">Card number<input class="inp mono" placeholder="•••• •••• •••• ••••"></label>
            <div class="grid g2" style="gap:14px">
              <label class="f">Expiry<input class="inp mono" placeholder="MM / YY"></label>
              <label class="f">CVC<input class="inp mono" placeholder="•••"></label>
            </div>
            <div class="grid g2" style="gap:14px">
              <label class="f">Billing ZIP<input class="inp mono" placeholder="33431"></label>
              <label class="f">Country<select class="inp"><option>United States</option><option>Canada</option></select></label>
            </div>
            <button class="btn btn-p btn-lg btn-block pulse" data-go="done"><span>Start 14-day trial</span><i class="spec"></i></button>
            <p class="tiny">You will not be charged today. Cancel any time before day 14 and you pay nothing.</p>
          </div>
        </div>

        <div class="stack g20">
          <div class="card elev-raised rv-3d">
            <span class="micro">Order summary</span>
            <div class="row" style="justify-content:space-between;margin-top:14px">
              <b id="ckPlan">Claim Buddy Pro</b>
              <span class="mono" id="ckUnit" data-amt="120" data-base="120" data-inc="3" data-rate="30">$120</span>
            </div>
            <label class="f" style="margin-top:16px">Seats
              <select class="inp" id="ckSeats"></select></label>
            <div class="row" style="justify-content:space-between;margin-top:14px">
              <span class="tiny">Additional seats</span><span class="mono acc" id="ckDisc">—</span>
            </div>
            <div class="dim" style="margin:18px 0 14px"><span>Total</span></div>
            <div class="row" style="justify-content:space-between;align-items:flex-end">
              <span class="price" id="ckTotal">$120</span>
              <span class="tiny">/ month after trial</span>
            </div>
          </div>
          <div class="card elev-card rv">
            <span class="micro">What you can change later</span>
            <ul class="ticks" style="margin-top:14px">
              <li>Add or remove seats any time — prorated</li>
              <li>Switch plan up or down at the next cycle</li>
              <li>Cancel from the admin panel, no phone call</li>
              <li>Export all your data on the way out</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>`,
  done: `  <div class="sec">
    <div class="wrap" style="max-width:660px">
      <div class="card elev-float rv-3d" style="overflow:hidden;position:relative">
        <div style="position:absolute;inset:auto auto -50% 50%;transform:translateX(-50%);width:560px;height:320px;
          background:radial-gradient(circle,rgba(var(--accent-rgb),.18),transparent 66%);pointer-events:none"></div>
        <div class="stack g16" style="position:relative">
          <span class="micro">Confirmed</span>
          <h2>You're booked.</h2>
          <p class="lead" style="font-size:1rem">A confirmation is on its way with your slot and a calendar invite.</p>
          <div class="dim" style="margin:12px 0"><span>Confirmation email — preview</span></div>
          <div class="card" style="background:var(--bg);box-shadow:inset 0 1px 3px rgba(15,23,42,.08)">
            <p class="mono tiny">To: you@company.com</p>
            <p style="font-weight:700;margin-top:12px">Your Claim Buddy demo — Thursday 2:00 PM</p>
            <p class="tiny" style="margin-top:10px;line-height:1.65">Thanks for booking. We'll open the app
              on the call and measure the address you gave us live, so bring one you know well. If that
              time stops working, reply to this email and we'll move it — no forms.</p>
            <p class="tiny" style="margin-top:10px">— The Claim Buddy team</p>
          </div>
          <button class="btn btn-s" data-v="home" style="align-self:flex-start"><span>Back to home</span><i class="spec"></i></button>
        </div>
      </div>
    </div>
  </div>`,
};

export type RefViewKey = keyof typeof REF_VIEWS;

export const REF_HEADER = `
<header class="nav" id="hdr">
  <div class="wrap nav-in">
    <!-- Empty slot: hidden by default. On the platform surface (globalcontractor.app)
         the runtime moves the hero logo here so it bleeds from the header into the
         hero. On gcn.claims the header stays logo-free and the logo stays in the hero. -->
    <button class="nav-logo" data-v="home" aria-label="Global Contractor Network — home"></button>
    <button class="menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false"><i></i></button>
    <nav class="links" id="nav">
      <button data-v="home" aria-current="page">Home</button>
      <button data-v="product">The app</button>
      <button data-v="gallery">Gallery</button>
      <button data-v="pricing">Pricing</button>
      <button data-v="resources">Resources</button>
      <button data-v="blog">Blog</button>
      <button class="nav-signin-item" data-go="signin">Log in</button>
    </nav>
    <div class="row nav-cta" style="gap:8px;flex-wrap:nowrap">
      <button class="themer" id="themer" aria-label="Toggle theme" title="Toggle theme">◐</button>
      <button class="nav-signin-m" data-go="signin">Log in</button>
      <button class="btn btn-s" data-go="signin"><span>Log in</span><i class="spec"></i></button>
      <button class="btn btn-p" data-go="signup"><span>Book a demo</span><i class="spec"></i></button>
    </div>
  </div>
</header>`;

export const REF_FOOTER = `
<footer>
  <div class="wrap">
    <div class="grid g4" style="gap:30px">
      <div class="stack g12">
        <span class="foot-plaque"><img class="foot-logo" id="footLogo" alt="Claim Buddy — powered by Global Contractor Network"></span>
        <p class="tiny">Insurance restoration inspection and estimating, from the driveway.</p>
        <p class="tiny mono">gcn.claims</p>
      </div>
      <div><div class="micro" style="margin-bottom:10px">Product</div>
        <a data-v="product">The app</a><a data-v="gallery">Gallery</a><a data-v="pricing">Pricing</a><a data-v="resources">Resources</a></div>
      <div><div class="micro" style="margin-bottom:10px">Company</div>
        <a data-v="blog">Blog</a><a data-go="signup">Book a demo</a><a data-go="signin">Log in</a><a data-v="faq">FAQ</a></div>
      <div><div class="micro" style="margin-bottom:10px">Legal</div>
        <a>Privacy policy</a><a>Terms of service</a><a>Data processing</a></div>
    </div>
    <p class="tiny" style="margin-top:34px">© 2026 Global Contractor Network. Insurance restoration inspection,
      estimating and presentation software.</p>
  </div>
</footer>`;
