(function () {
  "use strict";
  var So = window.So, Lunar = window.Lunar;
  if (!So || !Lunar) return;

  var $ = function (s) { return document.querySelector(s); };
  var el = So.el;
  var today = new Date();
  var y = today.getFullYear(), m = today.getMonth() + 1;
  var mode = "month", dayOpen = null, activeView = "list";

  var WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  var DAYNAMES = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

  function pad(n) { return String(n).padStart(2, "0"); }
  function key(yy, mm, dd) { return yy + "-" + pad(mm) + "-" + pad(dd); }
  function todayKey() { var t = new Date(); return key(t.getFullYear(), t.getMonth() + 1, t.getDate()); }

  var KIND_LABEL = { nap: "Nạp Tài", cuoi: "Ngày Cưới" };

  /* map[ngày] = [{ job, kinds: ["nap","cuoi"], time }]. Hợp đồng có hai ngày thì xuất hiện ở cả hai ngày.
     Nếu hai ngày trùng nhau thì chỉ có một mục với hai nhãn. */
  function jobsByDay() {
    var map = {};
    So.jobs().forEach(function (j) {
      var seen = {};
      So.datesOf(j).forEach(function (x) {
        var d = String(x.when || "").slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
        var entry = seen[d];
        if (!entry) { entry = seen[d] = { job: j, kinds: [], time: x.when }; (map[d] = map[d] || []).push(entry); }
        entry.kinds.push(x.kind);
        if (String(x.when) < String(entry.time)) entry.time = x.when;
      });
    });
    Object.keys(map).forEach(function (k) { map[k].sort(function (a, b) { return String(a.time).localeCompare(String(b.time)); }); });
    return map;
  }

  function lunarShort(dd, mm, yy) {
    var l = Lunar.fromSolar(dd, mm, yy);
    return { l: l, text: l.day === 1 ? l.day + "/" + l.month + (l.leap ? "n" : "") : String(l.day) };
  }

  /* ---------- Chuyển giữa Danh sách và Lịch ---------- */
  function setView(v) {
    activeView = v;
    $("#listView").hidden = v !== "list";
    $("#calView").hidden = v !== "cal";
    $("#vList").setAttribute("aria-selected", String(v === "list"));
    $("#vCal").setAttribute("aria-selected", String(v === "cal"));
    refresh();
  }

  /* ---------- Xem theo tháng ---------- */
  function renderMonth(map) {
    var body = $("#calBody"); body.textContent = "";
    var first = new Date(y, m - 1, 1), offset = (first.getDay() + 6) % 7, dim = new Date(y, m, 0).getDate();
    var a = Lunar.fromSolar(1, m, y), b = Lunar.fromSolar(dim, m, y);
    $("#calTitle").textContent = "Tháng " + m + " / " + y;
    $("#calSub").textContent = "Âm lịch tháng " + a.month + (a.leap ? " nhuận" : "") +
      (a.month !== b.month || a.leap !== b.leap ? " đến tháng " + b.month + (b.leap ? " nhuận" : "") : "") +
      " · năm " + Lunar.canChi(b.year);

    var grid = el("div", "cal-grid");
    WD.forEach(function (w, i) { grid.appendChild(el("div", "cal-wd" + (i === 6 ? " sun" : ""), w)); });
    for (var i = 0; i < offset; i++) grid.appendChild(el("div", "cal-blank"));
    var tk = todayKey();
    for (var d = 1; d <= dim; d++) {
      var k = key(y, m, d), list = map[k] || [], ls = lunarShort(d, m, y);
      var cell = el("button", "cal-day" + (k === tk ? " today" : "") + (list.length ? " has" : "") + (ls.l.day === 1 ? " lfirst" : "") + (ls.l.day === 15 ? " lfull" : ""));
      cell.type = "button";
      cell.setAttribute("aria-label", "Ngày " + d + " tháng " + m + ", âm lịch " + ls.l.day + " tháng " + ls.l.month + (ls.l.leap ? " nhuận" : "") +
        (list.length ? ", " + list.length + " hợp đồng" : ", chưa có hợp đồng"));
      cell.appendChild(el("span", "sd", String(d)));
      cell.appendChild(el("span", "ld", ls.text));
      var dots = el("span", "dots");
      for (var n = 0; n < Math.min(list.length, 3); n++) dots.appendChild(el("i", list[n].kinds.indexOf("cuoi") > -1 ? "" : "nap"));
      cell.appendChild(dots);
      (function (kk) { cell.addEventListener("click", function () { openDay(kk); }); })(k);
      grid.appendChild(cell);
    }
    body.appendChild(grid);
    body.appendChild(el("p", "help", "Số lớn là ngày dương, số nhỏ là ngày âm (1/10 nghĩa là mùng 1 tháng 10, chữ n là tháng nhuận). Chấm xanh là Ngày Cưới, chấm cam là Nạp Tài. Bấm vào một ngày để xem chi tiết."));
  }

  /* ---------- Xem cả năm ---------- */
  function renderYear(map) {
    var body = $("#calBody"); body.textContent = "";
    $("#calTitle").textContent = "Năm " + y;
    $("#calSub").textContent = "Năm " + Lunar.canChi(y) + " (âm lịch)";
    var wrap = el("div", "year-grid"), tk = todayKey();
    for (var mm = 1; mm <= 12; mm++) {
      var box = el("button", "mini"); box.type = "button";
      box.setAttribute("aria-label", "Mở tháng " + mm + " năm " + y);
      var ids = {}, total = 0;
      var mg = el("div", "mini-grid");
      var first = new Date(y, mm - 1, 1), offset = (first.getDay() + 6) % 7, dim = new Date(y, mm, 0).getDate();
      for (var i = 0; i < offset; i++) mg.appendChild(el("span", "mc blank"));
      for (var d = 1; d <= dim; d++) {
        var k = key(y, mm, d), c = (map[k] || []).length;
        (map[k] || []).forEach(function (x) { if (!ids[x.job.id]) { ids[x.job.id] = 1; total++; } });
        mg.appendChild(el("span", "mc" + (c ? " has" : "") + (k === tk ? " today" : ""), String(d)));
      }
      var head = el("div", "mini-head");
      head.appendChild(el("b", null, "Tháng " + mm));
      if (total) head.appendChild(el("span", "mini-count", total + " HĐ"));
      box.appendChild(head); box.appendChild(mg);
      (function (mo) { box.addEventListener("click", function () { m = mo; mode = "month"; refresh(); }); })(mm);
      wrap.appendChild(box);
    }
    body.appendChild(wrap);
    body.appendChild(el("p", "help", "Ngày tô màu là ngày có Nạp Tài hoặc Ngày Cưới. Bấm vào một tháng để mở lịch tháng đó. HĐ là hợp đồng."));
  }

  /* ---------- Chi tiết một ngày ---------- */
  function openDay(k) { dayOpen = k; $("#dscrim").hidden = false; renderDay(); }
  function closeDay() { dayOpen = null; $("#dscrim").hidden = true; }

  function renderDay() {
    if (!dayOpen) return;
    var p = dayOpen.split("-").map(Number), dt = new Date(p[0], p[1] - 1, p[2]);
    var l = Lunar.fromSolar(p[2], p[1], p[0]);
    $("#dTitle").textContent = DAYNAMES[dt.getDay()] + ", " + pad(p[2]) + "/" + pad(p[1]) + "/" + p[0];
    $("#dLunar").textContent = "Âm lịch: ngày " + l.day + " tháng " + l.month + (l.leap ? " nhuận" : "") + " năm " + Lunar.canChi(l.year);
    var list = (jobsByDay()[dayOpen] || []), box = $("#dList"); box.textContent = "";
    if (!list.length) {
      var e = el("div", "empty");
      e.appendChild(el("strong", null, "Chưa có hợp đồng nào trong ngày này"));
      e.appendChild(el("span", null, "Bấm nút bên dưới để ghi lịch chụp cho ngày này."));
      box.appendChild(e);
    } else {
      var owed = list.reduce(function (s, x) { return s + So.remaining(x.job); }, 0);
      box.appendChild(el("p", "help", list.length + " hợp đồng · còn phải thu " + So.money(owed)));
      list.forEach(function (x) {
        box.appendChild(el("span", "day-tag", x.kinds.map(function (k) { return KIND_LABEL[k]; }).join(" + ")));
        box.appendChild(So.card(x.job));
      });
    }
  }

  /* ---------- Vẽ lại ---------- */
  function refresh() {
    if (activeView === "cal") {
      var map = jobsByDay();
      if (mode === "month") renderMonth(map); else renderYear(map);
      $("#calMode").textContent = mode === "month" ? "Xem cả năm" : "Xem theo tháng";
    }
    if (dayOpen) renderDay();
  }

  function step(dir) {
    if (mode === "year") y += dir;
    else { m += dir; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } }
    refresh();
  }

  $("#vList").addEventListener("click", function () { setView("list"); });
  $("#vCal").addEventListener("click", function () { setView("cal"); });
  $("#calPrev").addEventListener("click", function () { step(-1); });
  $("#calNext").addEventListener("click", function () { step(1); });
  $("#calToday").addEventListener("click", function () { var t = new Date(); y = t.getFullYear(); m = t.getMonth() + 1; mode = "month"; refresh(); });
  $("#calMode").addEventListener("click", function () { mode = mode === "month" ? "year" : "month"; refresh(); });
  $("#dClose").addEventListener("click", closeDay);
  $("#dAddNap").addEventListener("click", function () { if (dayOpen) So.openSheet(null, { field: "napTai", date: dayOpen }); });
  $("#dAddCuoi").addEventListener("click", function () { if (dayOpen) So.openSheet(null, { field: "ngayCuoi", date: dayOpen }); });
  $("#dscrim").addEventListener("click", function (e) { if (e.target === $("#dscrim")) closeDay(); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !dayOpen) return;
    if (!$("#scrim").hidden || !$("#bscrim").hidden) return;
    closeDay();
  });

  window.SoCal = { refresh: refresh };
  refresh();
})();
