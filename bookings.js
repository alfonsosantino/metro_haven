/* =========================================================
   METRO HAVEN — BOOKED DATES
   Edit this file to block dates on the calendar page.

   Each booking:  { in: "YYYY-MM-DD", out: "YYYY-MM-DD" }
     in  = check-in date  (this night is booked)
     out = check-out date (this day stays OPEN for the next guest)

   Example: a guest staying the nights of Nov 6 and Nov 7,
   checking out Nov 8:
       { in: "2026-11-06", out: "2026-11-08" },

   After editing: git add . / git commit -m "Update bookings" / git push
   ========================================================= */

window.METRO_HAVEN_BOOKINGS = {

  ebony: [
    // { in: "2026-11-06", out: "2026-11-08" },
  ],

  cedar: [
    // { in: "2026-11-13", out: "2026-11-15" },
  ],

  willow: [
    // { in: "2026-11-20", out: "2026-11-22" },
  ],

};
