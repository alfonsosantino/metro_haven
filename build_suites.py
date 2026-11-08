# Generates ebony-suite.html, cedar-suite.html, willow-suite.html from one template.
import json, html
from urllib.parse import quote

FB = "https://www.facebook.com/profile.php?id=61566400330651"
MSG = "https://m.me/61566400330651"

SUITES = {
 "ebony": dict(incl=2, max=4,
   name="Ebony Suite", type="Open-concept 1BR", vibe="Modern city hideaway",
   where="Tower 3 · 19th Floor", price="1,999", rating=None,
   lead="A modern city hideaway with rich dark-oak accents, gray tones, and a bright, hotel-inspired atmosphere. Located high above the city, Ebony Suite offers a relaxing space where you can enjoy the skyline while making the most of your stay.",
   stats=[("pin","19th floor · city view"),("sofa","Open-concept layout"),("bath","1 bathroom"),("users","Rate for 2 · max 4")],
   photos=["ebony_11","ebony_02","ebony_01","ebony_00","ebony_12","ebony_10"],
   groups=[
     ("Open-concept living space","sofa",["Open-layout unit with no separate room divider or bedroom door","Comfortable sofa bed","Dining area for 2 guests"]),
     ("Entertainment","tv",["Large Smart TV","Karaoke","Board and card games"]),
     ("Kitchen","pot",["Kitchen area","Cooking and dining essentials","Complete kitchen supplies and utensils"]),
     ("Bathroom","bath",["Modern bathroom design","Shower facilities"]),
     ("City view","building",["19th-floor location","Enjoy the city skyline from your staycation space"]),
   ],
   closing=("Your city staycation","Enjoy movie nights, sing your favorite songs, play games, or simply take in the city view. Ebony Suite brings together the convenience of a modern space and the experience of a hotel-inspired getaway."),
   airbnb=None),
 "cedar": dict(incl=3, max=6,
   name="Cedar Suite", type="1 Bedroom", vibe="Rustic industrial charm",
   where="Tower 1 · 2nd Floor", price="2,199", rating=("4.71","91","https://www.airbnb.com/rooms/1250604774381847146"),
   lead="Warm textures, rustic details, and an industrial-inspired interior come together in this cozy hideaway — made for laid-back stays, good company, and a little fun along the way.",
   stats=[("bed","1 bedroom"),("sofa","Bunk + pull-out beds"),("bath","1 bathroom"),("users","Rate for 3 · max 6")],
   photos=["cedar_02","cedar_10","cedar_11","cedar_00"],
   groups=[
     ("Sleep & relax","bed",["Bunk bed with additional pull-out bed","Sofa with pull-out bed","Comfortable living space","Balcony"]),
     ("Fun & entertainment","tv",["Board games","Smart TV","Karaoke"]),
     ("Kitchen","pot",["Kitchen for your staycation meals","Complete kitchen essentials"]),
     ("Bathroom","bath",["Shower heater","Bidet"]),
   ],
   closing=("Plenty of ways to enjoy your stay","Whether you're spending the day playing board games, singing your favorite songs, cooking together, or simply enjoying the balcony, Cedar Suite gives you plenty of ways to enjoy your stay."),
   airbnb="https://www.airbnb.com/rooms/1250604774381847146"),
 "willow": dict(incl=5, max=8,
   name="Willow Suite", type="2 Bedrooms", vibe="Perfect for groups & families",
   where="Tower 1 · 5th Floor", price="4,599", rating=("4.88","52","https://www.airbnb.com/rooms/1344877140733324297"),
   lead="A spacious staycation made for bigger groups, longer conversations, and shared moments.",
   stats=[("bed","2 bedrooms"),("bath","2 bathrooms"),("sofa","Sofa pull-out bed"),("users","Rate for 5 · max 8")],
   photos=["willow_01","willow_02","willow_11","willow_10","willow_12","willow_00"],
   groups=[
     ("Bedroom 1","bed",["1 bed","Own bathroom"]),
     ("Bedroom 2","bed",["Bed that can accommodate 2 guests","Additional bed","Smart TV","Own bathroom"]),
     ("Living area","sofa",["Spacious sofa with pull-out bed","Smart TV access","Plenty of room for everyone to gather"]),
     ("Big kitchen","pot",["Spacious kitchen","Ideal for preparing meals and enjoying food together"]),
     ("Dining area","table",["Large brown dining table","Rattan chandelier centerpiece"]),
   ],
   closing=("A space for everyone","From cooking and dining together to settling in for a movie or simply enjoying a long conversation, Willow Suite gives everyone room to enjoy the stay without feeling crowded."),
   airbnb="https://www.airbnb.com/rooms/1344877140733324297"),
}

BUILDING = ["Shared swimming pool","Walkway bridge to SM North EDSA","Near Trinoma & Solaire North","24/7 lobby security"]

ICONS = '''<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></symbol>
  <symbol id="i-bed" viewBox="0 0 24 24"><path d="M3 19V6M3 14h18v5M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="10.5" r="2"/></symbol>
  <symbol id="i-sofa" viewBox="0 0 24 24"><path d="M5 11V8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v3"/><path d="M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3z"/><path d="M5 18v2M19 18v2"/></symbol>
  <symbol id="i-bath" viewBox="0 0 24 24"><path d="M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M6 12V5a2 2 0 0 1 3.5-1.3M7 20l-1 2M17 20l1 2"/></symbol>
  <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></symbol>
  <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></symbol>
  <symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></symbol>
  <symbol id="i-tv" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></symbol>
  <symbol id="i-pot" viewBox="0 0 24 24"><path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M2 10h2M20 10h2M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"/></symbol>
  <symbol id="i-building" viewBox="0 0 24 24"><path d="M4 21V5l8-2v18M12 7l8 2v12M2 21h20M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2"/></symbol>
  <symbol id="i-table" viewBox="0 0 24 24"><path d="M3 9h18M5 9v11M19 9v11M12 3v3M8 6h8"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-left" viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></symbol>
  <symbol id="i-right" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></symbol>
</svg>'''

def ic(n, cls=""):
    return f'<svg class="i{(" "+cls) if cls else ""}" aria-hidden="true"><use href="#i-{n}"/></svg>'

def page(key):
    s = SUITES[key]
    others = [k for k in SUITES if k != key]
    ph = s["photos"]
    gallery = (f'<button class="g g-main" data-i="0"><img src="img/{ph[0]}.jpg" alt="{s["name"]} photo 1"></button>' +
               "".join(f'<button class="g" data-i="{i}"><img src="img/{p}.jpg" alt="{s["name"]} photo {i+1}" loading="lazy"></button>' for i, p in enumerate(ph[1:5], 1)))
    rating = ""
    if s["rating"]:
        r, n, url = s["rating"]
        rating = f'<a class="rating" href="{url}" target="_blank" rel="noopener">{ic("star","fill")} <b>{r}</b> · {n} Airbnb reviews</a>'
    stats = "".join(f'<div class="stat">{ic(i)}<span>{html.escape(t)}</span></div>' for i, t in s["stats"])
    groups = "".join(f'<div class="grp"><div class="gh">{ic(icon)}<h4>{html.escape(t)}</h4></div><ul>' + "".join(f"<li>{ic('check')}{html.escape(x)}</li>" for x in items) + "</ul></div>" for t, icon, items in s["groups"])
    building = "".join(f"<li>{ic('check')}{html.escape(x)}</li>" for x in BUILDING)
    ct, cx = s["closing"]
    other_cards = "".join(f'''<a class="oc" href="{k}-suite.html"><img src="img/{SUITES[k]["photos"][0]}.jpg" alt="" loading="lazy"><div><span class="ot">{SUITES[k]["type"]} · {SUITES[k]["where"]}</span><b>{SUITES[k]["name"]}</b><span class="op">From <strong>₱{SUITES[k]["price"]}</strong> / night</span></div></a>''' for k in others)
    airbnb_btn = f'<a class="link" href="{s["airbnb"]}" target="_blank" rel="noopener">Read our Airbnb reviews ↗</a>' if s["airbnb"] else ""
    photos_json = json.dumps([f"img/{p}.jpg" for p in ph])
    msg = f'{MSG}?text=' + quote(f"Hi Metro Haven! I'm interested in the {s['name']}.")
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{s["name"]} — Metro Haven · Grass Residences, Quezon City</title>
<meta name="description" content="{html.escape(s["lead"])} From ₱{s["price"]} per night. Book direct with Metro Haven.">
<link rel="icon" type="image/png" sizes="32x32" href="img/favicon-32.png">
<link rel="icon" type="image/png" sizes="48x48" href="img/favicon-48.png">
<link rel="apple-touch-icon" href="img/apple-touch-icon.png">
<meta name="theme-color" content="#06302a">
<link href="https://fonts.googleapis.com/css2?family=Lilita+One&family=Jost:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/suite.css">
</head>
<body>
{ICONS}
<nav>
  <div class="wrap">
    <a class="brand" href="index.html"><img src="img/logo_dark.png" alt="Metro Haven"><span>METRO HAVEN<small>your urban escape.</small></span></a>
    <ul id="menu">
      <li><a href="index.html#suites">Our Suites</a></li>
      <li><a href="index.html#amenities">Amenities</a></li>
      <li><a href="index.html#book">How to Book</a></li>
      <li><a href="index.html#rules">House Rules</a></li>
      <li><a href="index.html#location">Location</a></li>
    </ul>
    <a class="btn btn-dark nav-cta" href="calendar.html?suite={key}">Check dates →</a>
    <button class="menu-btn" aria-label="Menu" onclick="document.getElementById('menu').classList.toggle('open')"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06302a" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  </div>
</nav>

<main class="wrap">
  <div class="crumbs"><a href="index.html">Home</a> / <a href="index.html#suites">Our Suites</a> / <span>{s["name"]}</span></div>

  <header class="head">
    <div>
      <div class="eyebrow">{s["type"]} · {s["vibe"]}</div>
      <h1>{s["name"]}</h1>
      <div class="meta"><span>{ic("pin")}The Grass Residences, {s["where"]}</span>{rating}</div>
    </div>
  </header>

  <section class="gallery">
    {gallery}
    <button class="all" id="showAll">{ic("grid")}Show all {len(ph)} photos</button>
  </section>

  <div class="layout">
    <div class="content">
      <p class="lead">{html.escape(s["lead"])}</p>
      <div class="stats">{stats}</div>

      <section class="block">
        <h2>Inside {s["name"]}</h2>
        <div class="groups">{groups}</div>
      </section>

      <section class="block closing">
        <div class="eyebrow">{s["name"]} by Metro Haven</div>
        <h2>{html.escape(ct)}</h2>
        <p>{html.escape(cx)}</p>
      </section>

      <section class="block">
        <h2>At The Grass Residences</h2>
        <ul class="bl">{building}</ul>
      </section>

      <section class="block">
        <h2>Good to know</h2>
        <div class="know">
          <div>{ic("clock")}<span><small>Check-in</small><b>3:00 PM</b></span></div>
          <div>{ic("clock")}<span><small>Check-out</small><b>12:00 NN</b></span></div>
          <div>{ic("users")}<span><small>Extra guest</small><b>₱250 / night</b></span></div>
        </div>
        <p class="small">Please read our <a href="index.html#rules">house rules</a> before booking. Exact tower and unit details are sent once your booking is confirmed.</p>
      </section>
    </div>

    <aside class="book">
      <div class="bcard">
        <div class="price"><small>Starts at</small><b>₱{s["price"]}</b><span>/ night</span></div>
        <p class="pnote">Per night for up to {s["incl"]} guests · ₱250 per extra guest per night (max {s["max"]}). Infants free.</p>
        <a class="btn btn-dark" href="calendar.html?suite={key}">{ic("cal")}Check available dates</a>
        <a class="btn btn-ghost" href="{msg}" target="_blank" rel="noopener">{ic("chat")}Message us</a>
        <ul class="perks"><li>{ic("check")}No platform service fees</li><li>{ic("check")}Owner-confirmed payments</li><li>{ic("check")}Replies within an hour</li></ul>
        {airbnb_btn}
      </div>
    </aside>
  </div>

  <section class="others">
    <h2>Other suites</h2>
    <div class="ogrid">{other_cards}</div>
  </section>
</main>

<div class="mbar"><div><b>₱{s["price"]}</b> <span>/ night</span><small>Starting rate</small></div><a class="btn btn-dark" href="calendar.html?suite={key}">Check dates</a></div>

<div class="lb" id="lb" hidden>
  <button class="lbx" id="lbClose" aria-label="Close">{ic("x")}</button>
  <button class="lbn lbp" id="lbPrev" aria-label="Previous photo">{ic("left")}</button>
  <img id="lbImg" alt="">
  <button class="lbn lbnx" id="lbNext" aria-label="Next photo">{ic("right")}</button>
  <div class="lbc" id="lbCount"></div>
</div>

<footer>
  <div class="wrap">
    <img src="img/logo_light.png" alt="">
    <div class="flinks"><a href="index.html">Home</a><a href="ebony-suite.html">Ebony Suite</a><a href="cedar-suite.html">Cedar Suite</a><a href="willow-suite.html">Willow Suite</a><a href="calendar.html">Availability</a><a href="{FB}" target="_blank" rel="noopener">Facebook</a></div>
    <div class="fbot">© 2026 Metro Haven · The Grass Residences, Quezon City</div>
  </div>
</footer>

<script>
const PHOTOS = {photos_json};
let cur = 0;
const lb = document.getElementById("lb"), img = document.getElementById("lbImg"), cnt = document.getElementById("lbCount");
function show(i){{ cur = (i + PHOTOS.length) % PHOTOS.length; img.src = PHOTOS[cur]; cnt.textContent = (cur+1) + " / " + PHOTOS.length; }}
function open_(i){{ show(i); lb.hidden = false; document.body.style.overflow = "hidden"; }}
function close_(){{ lb.hidden = true; document.body.style.overflow = ""; }}
document.querySelectorAll(".g").forEach(b => b.onclick = () => open_(+b.dataset.i));
document.getElementById("showAll").onclick = () => open_(0);
document.getElementById("lbClose").onclick = close_;
document.getElementById("lbPrev").onclick = () => show(cur-1);
document.getElementById("lbNext").onclick = () => show(cur+1);
lb.onclick = e => {{ if(e.target === lb) close_(); }};
document.addEventListener("keydown", e => {{ if(lb.hidden) return; if(e.key==="Escape") close_(); if(e.key==="ArrowLeft") show(cur-1); if(e.key==="ArrowRight") show(cur+1); }});
</script>
</body>
</html>
'''

for k in SUITES:
    open(f"{k}-suite.html", "w").write(page(k))
print("built", list(SUITES))
