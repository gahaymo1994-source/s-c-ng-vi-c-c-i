(function () {
  "use strict";
  var KEY = "sovieccuoi.v1";
  var KEEP_MONTHS = 2;
  var DAY = 86400000;
  var $ = function (s) { return document.querySelector(s); };
  var jobs = [], tab = "up", query = "", editingId = null, delArmed = false, delTimer = null;
  var storageOk = true, notice = "", needsSave = false;

  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* Đưa dữ liệu bản cũ (when, phone) về dạng mới (napTai, ngayCuoi, phoneBride, phoneGroom). */
  function migrate(x) {
    if (x.when !== undefined || x.phone !== undefined || !x.id) needsSave = true;
    return {
      id: x.id ? String(x.id) : newId(),
      name: String(x.name || ""),
      phoneBride: String(x.phoneBride != null ? x.phoneBride : (x.phone || "")),
      phoneGroom: String(x.phoneGroom || ""),
      napTai: String(x.napTai || ""),
      ngayCuoi: String(x.ngayCuoi != null ? x.ngayCuoi : (x.when || "")),
      chupTiec: !!x.chupTiec,
      takeCare: !!x.takeCare,
      addrGroom: String(x.addrGroom || ""),
      addrBride: String(x.addrBride || ""),
      pkg: String(x.pkg || ""),
      price: Number(x.price) || 0,
      deposit: Number(x.deposit) || 0,
      ekip: String(x.ekip || ""),
      notes: String(x.notes || ""),
      createdAt: Number(x.createdAt) || Date.now()
    };
  }

  /* ---------- Lưu trữ ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var arr = raw ? JSON.parse(raw) : [];
      jobs = Array.isArray(arr) ? arr.filter(function (x) { return x && typeof x === "object"; }).map(migrate) : [];
    } catch (e) { jobs = []; storageOk = false; }
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(jobs)); return true; }
    catch (e) { storageOk = false; showNote(); return false; }
  }

  /* ---------- Tiện ích ---------- */
  function digits(s) { return parseInt(String(s || "").replace(/\D/g, ""), 10) || 0; }
  function money(n) { return new Intl.NumberFormat("vi-VN").format(n || 0) + " ₫"; }
  function grouped(n) { return n ? new Intl.NumberFormat("vi-VN").format(n) : ""; }
  function parseWhen(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || "");
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
  }
  var DAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
  function fmtWhen(s) {
    var d = parseWhen(s); if (!d) return "Chưa có ngày giờ";
    var p = function (x) { return String(x).padStart(2, "0"); };
    return DAYS[d.getDay()] + ", " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() + " · " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function noAccent(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase(); }
  function remaining(j) { return Math.max(0, (j.price || 0) - (j.deposit || 0)); }

  /* ---------- Hai ngày làm việc, hoàn thành, tự xóa ---------- */
  function events(j) {
    var out = [];
    if (parseWhen(j.napTai)) out.push({ kind: "Nạp Tài", when: j.napTai });
    if (parseWhen(j.ngayCuoi)) out.push({ kind: "Ngày Cưới", when: j.ngayCuoi });
    return out;
  }
  function lastDate(j) {
    var best = null;
    events(j).forEach(function (e) { var d = parseWhen(e.when); if (!best || d > best) best = d; });
    return best;
  }
  /* Hoàn thành khi ngày làm việc cuối cùng đã qua (từ 0h sáng hôm sau). */
  function isDone(j) {
    var l = lastDate(j); if (!l) return false;
    return startOfToday() >= new Date(l.getFullYear(), l.getMonth(), l.getDate() + 1);
  }
  function purgeDate(j) {
    var l = lastDate(j);
    return l ? new Date(l.getFullYear(), l.getMonth() + KEEP_MONTHS, l.getDate()) : null;
  }
  function expired(j) { var p = purgeDate(j); return !!p && isDone(j) && startOfToday() >= p; }
  function daysLeft(j) { var p = purgeDate(j); return p ? Math.max(0, Math.round((p - startOfToday()) / DAY)) : 0; }
  function nextKey(j) {
    var t0 = startOfToday().getTime(), best = Infinity, any = null;
    events(j).forEach(function (e) {
      var t = parseWhen(e.when).getTime();
      if (t >= t0 && t < best) best = t;
      if (any === null || t > any) any = t;
    });
    return best !== Infinity ? best : (any === null ? Infinity : any);
  }

  function purge() {
    var keep = jobs.filter(function (j) { return !expired(j); });
    var n = jobs.length - keep.length;
    if (!n) return 0;
    var before = jobs; jobs = keep;
    if (!persist()) { jobs = before; return 0; }
    return n;
  }

  function showNote() {
    var n = $("#note");
    var t = !storageOk ? "Điện thoại đang chặn lưu dữ liệu (có thể do chế độ riêng tư). Hãy mở ứng dụng từ biểu tượng trên màn hình chính." : notice;
    n.textContent = t; n.hidden = !t;
  }

  /* ---------- Hiển thị ---------- */
  function row(label, node, cls) {
    var r = el("div", "row" + (cls ? " " + cls : ""));
    r.appendChild(el("dt", null, label));
    var dd = el("dd"); dd.appendChild(node); r.appendChild(dd);
    return r;
  }
  function span(t, cls) { return el("span", cls, t); }

  function copyText(text, btn, node) {
    var done = function () { var o = btn.textContent; btn.textContent = "Đã chép"; setTimeout(function () { btn.textContent = o; }, 1400); };
    var fallback = function () {
      try { var r = document.createRange(); r.selectNodeContents(node); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }

  function phoneNode(num) {
    var ph = el("div", "phone-line");
    if (num) {
      var ps = span(num, "num"); ph.appendChild(ps);
      var call = el("a", "btn small", "Gọi"); call.href = "tel:" + num.replace(/[^\d+]/g, ""); ph.appendChild(call);
      var cb = el("button", "btn small", "Chép số"); cb.type = "button";
      cb.addEventListener("click", function () { copyText(num, cb, ps); });
      ph.appendChild(cb);
    } else ph.appendChild(span("Chưa có", "dim"));
    return ph;
  }

  function dateLine(label, s) {
    var r = el("div", "when-line"), ok = !!parseWhen(s);
    r.appendChild(el("span", "when-k", label));
    r.appendChild(el("span", "when-v" + (ok ? "" : " dim"), ok ? fmtWhen(s) : "Không có"));
    return r;
  }

  function card(j, tag) {
    var left = remaining(j), c = el("article", "card");
    var head = el("div", "card-head"), top = el("div", "card-top");
    top.appendChild(el("h3", "name", j.name || "Chưa đặt tên"));
    top.appendChild(el("span", "pill " + (left > 0 ? "owed" : "paid"), left > 0 ? "Còn nợ" : "Đã đủ"));
    head.appendChild(top);
    head.appendChild(dateLine("Nạp Tài", j.napTai));
    head.appendChild(dateLine("Ngày Cưới", j.ngayCuoi));
    if (tag) head.appendChild(el("span", "tag", tag));
    if (isDone(j)) head.appendChild(el("span", "tag", "Đã hoàn thành · tự xóa sau " + daysLeft(j) + " ngày"));
    c.appendChild(head);

    var dl = el("dl", "rows");
    dl.appendChild(row("SĐT cô dâu", phoneNode(j.phoneBride)));
    dl.appendChild(row("SĐT chú rể", phoneNode(j.phoneGroom)));
    dl.appendChild(row("Địa chỉ nhà trai", span(j.addrGroom || "Chưa ghi", j.addrGroom ? "" : "dim")));
    dl.appendChild(row("Địa chỉ nhà gái", span(j.addrBride || "Chưa ghi", j.addrBride ? "" : "dim")));
    var sv = el("div", "chips");
    if (j.chupTiec) sv.appendChild(el("span", "chip", "Chụp tiệc"));
    if (j.takeCare) sv.appendChild(el("span", "chip", "Take care"));
    if (!sv.children.length) sv.appendChild(span("Không", "dim"));
    dl.appendChild(row("Dịch vụ thêm", sv));
    dl.appendChild(row("Gói chụp", span(j.pkg || "Chưa ghi", j.pkg ? "" : "dim")));
    dl.appendChild(row("Giá gói", span(money(j.price), "num")));
    dl.appendChild(row("Đã cọc", span(money(j.deposit), "num")));
    dl.appendChild(row("Còn lại", span(money(left), "num"), "remain " + (left > 0 ? "owed" : "paid")));

    var parts = String(j.ekip || "").split(/[,\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var ch = el("div", "chips");
    if (parts.length) parts.forEach(function (p) { ch.appendChild(el("span", "chip", p)); });
    else ch.appendChild(span("Chưa ghi", "dim"));
    dl.appendChild(row("Ekip", ch));
    dl.appendChild(row("Yêu cầu riêng", span(j.notes || "Không có", "notes" + (j.notes ? "" : " dim"))));
    c.appendChild(dl);

    var foot = el("div", "card-foot"), eb = el("button", "btn", "Sửa"); eb.type = "button";
    eb.addEventListener("click", function () { openSheet(j); });
    foot.appendChild(eb); c.appendChild(foot);
    return c;
  }

  function render() {
    var up = jobs.filter(function (j) { return !isDone(j); }).sort(function (a, b) { return nextKey(a) - nextKey(b); });
    var done = jobs.filter(isDone).sort(function (a, b) { return lastDate(b) - lastDate(a); });
    $("#tOwed").textContent = money(jobs.reduce(function (s, j) { return s + remaining(j); }, 0));
    $("#tCount").textContent = String(up.length);
    $("#tabUp").textContent = "Sắp tới (" + up.length + ")";
    $("#tabPast").textContent = "Đã hoàn thành (" + done.length + ")";
    $("#tabUp").setAttribute("aria-selected", String(tab === "up"));
    $("#tabPast").setAttribute("aria-selected", String(tab === "done"));

    var shown = tab === "up" ? up : done, q = noAccent(query.trim());
    if (q) shown = shown.filter(function (j) {
      var nums = (String(j.phoneBride || "") + " " + String(j.phoneGroom || "")).replace(/\s/g, "");
      return noAccent(j.name).indexOf(q) > -1 || nums.indexOf(q.replace(/\s/g, "")) > -1;
    });

    var list = $("#list"); list.textContent = "";
    if (tab === "done") list.appendChild(el("p", "help", "Lịch xong sẽ tự chuyển vào đây và tự xóa sau " + KEEP_MONTHS + " tháng kể từ ngày làm việc cuối. Hãy sao lưu nếu cần giữ lâu hơn."));
    if (!shown.length) {
      var e = el("div", "empty");
      if (q) {
        e.appendChild(el("strong", null, "Không tìm thấy khách phù hợp"));
        e.appendChild(el("span", null, "Thử gõ tên hoặc số điện thoại khác."));
      } else {
        e.appendChild(el("strong", null, tab === "up" ? "Chưa có lịch chụp sắp tới" : "Chưa có lịch đã hoàn thành"));
        e.appendChild(el("span", null, tab === "up" ? "Bấm “Thêm lịch chụp” để ghi khách đầu tiên." : "Khi qua ngày làm việc cuối, lịch sẽ tự chuyển vào đây."));
      }
      list.appendChild(e);
    } else shown.forEach(function (j) { list.appendChild(card(j)); });
    if (window.SoCal) window.SoCal.refresh();
  }

  /* ---------- Form thêm/sửa ---------- */
  function updateRemain() { $("#fRemain").textContent = money(Math.max(0, digits($("#fPrice").value) - digits($("#fDeposit").value))); }
  ["#fPrice", "#fDeposit"].forEach(function (s) {
    $(s).addEventListener("input", function (e) { var n = digits(e.target.value); e.target.value = n ? grouped(n) : ""; updateRemain(); });
  });

  /* pre = { field: "napTai" | "ngayCuoi", date: "YYYY-MM-DD" } khi thêm từ màn hình Lịch */
  function openSheet(j, pre) {
    editingId = j ? j.id : null; delArmed = false;
    $("#sheetTitle").textContent = j ? "Sửa lịch chụp" : "Thêm lịch chụp";
    $("#fName").value = j ? (j.name || "") : "";
    $("#fPhoneBride").value = j ? (j.phoneBride || "") : "";
    $("#fPhoneGroom").value = j ? (j.phoneGroom || "") : "";
    $("#fNap").value = j ? (j.napTai || "") : (pre && pre.field === "napTai" ? pre.date + "T07:00" : "");
    $("#fCuoi").value = j ? (j.ngayCuoi || "") : (pre && pre.field === "ngayCuoi" ? pre.date + "T07:00" : "");
    $("#fTiec").checked = !!(j && j.chupTiec);
    $("#fCare").checked = !!(j && j.takeCare);
    $("#fAddrGroom").value = j ? (j.addrGroom || "") : "";
    $("#fAddrBride").value = j ? (j.addrBride || "") : "";
    $("#fPkg").value = j ? (j.pkg || "") : "";
    $("#fPrice").value = j ? grouped(j.price) : "";
    $("#fDeposit").value = j ? grouped(j.deposit) : "";
    $("#fEkip").value = j ? (j.ekip || "") : "";
    $("#fNotes").value = j ? (j.notes || "") : "";
    $("#err").textContent = "";
    $("#delBtn").hidden = !j; $("#delBtn").textContent = "Xóa lịch này";
    updateRemain();
    $("#scrim").hidden = false;
  }
  function closeSheet() { $("#scrim").hidden = true; clearTimeout(delTimer); }

  $("#addBtn").addEventListener("click", function () { openSheet(null); });
  $("#cancelBtn").addEventListener("click", closeSheet);
  $("#scrim").addEventListener("click", function (e) { if (e.target === $("#scrim")) closeSheet(); });
  $("#tabUp").addEventListener("click", function () { tab = "up"; render(); });
  $("#tabPast").addEventListener("click", function () { tab = "done"; render(); });
  $("#q").addEventListener("input", function (e) { query = e.target.value; render(); });

  $("#f").addEventListener("submit", function (ev) {
    ev.preventDefault();
    var name = $("#fName").value.trim();
    if (!name) { $("#err").textContent = "Nhập tên khách hàng trước khi lưu."; $("#fName").focus(); return; }
    var nap = $("#fNap").value, cuoi = $("#fCuoi").value;
    if (!parseWhen(nap) && !parseWhen(cuoi)) { $("#err").textContent = "Chọn ít nhất một ngày: Nạp Tài hoặc Ngày Cưới."; return; }
    var data = {
      name: name, phoneBride: $("#fPhoneBride").value.trim(), phoneGroom: $("#fPhoneGroom").value.trim(),
      napTai: nap, ngayCuoi: cuoi, chupTiec: $("#fTiec").checked, takeCare: $("#fCare").checked,
      addrGroom: $("#fAddrGroom").value.trim(), addrBride: $("#fAddrBride").value.trim(),
      pkg: $("#fPkg").value.trim(), price: digits($("#fPrice").value), deposit: digits($("#fDeposit").value),
      ekip: $("#fEkip").value.trim(), notes: $("#fNotes").value.trim()
    };
    var before = jobs.slice();
    if (editingId) {
      jobs = jobs.map(function (j) { return j.id === editingId ? Object.assign({}, j, data) : j; });
    } else {
      data.id = newId(); data.createdAt = Date.now(); jobs.push(data);
    }
    if (!persist()) { jobs = before; $("#err").textContent = "Chưa lưu được. Điện thoại đang chặn lưu dữ liệu hoặc bộ nhớ đã đầy."; return; }
    closeSheet(); render();
  });

  $("#delBtn").addEventListener("click", function () {
    if (!editingId) return;
    if (!delArmed) {
      delArmed = true; $("#delBtn").textContent = "Bấm lần nữa để xóa hẳn";
      delTimer = setTimeout(function () { delArmed = false; $("#delBtn").textContent = "Xóa lịch này"; }, 4000);
      return;
    }
    var before = jobs.slice();
    jobs = jobs.filter(function (j) { return j.id !== editingId; });
    if (!persist()) { jobs = before; $("#err").textContent = "Chưa xóa được. Thử lại sau."; return; }
    closeSheet(); render();
  });

  /* ---------- Sao lưu / khôi phục ---------- */
  $("#backupBtn").addEventListener("click", function () {
    $("#bText").value = JSON.stringify({ app: "so-viec-cuoi", version: 2, exportedAt: new Date().toISOString(), jobs: jobs }, null, 1);
    $("#bErr").textContent = "";
    $("#bscrim").hidden = false;
  });
  $("#bClose").addEventListener("click", function () { $("#bscrim").hidden = true; });
  $("#bscrim").addEventListener("click", function (e) { if (e.target === $("#bscrim")) $("#bscrim").hidden = true; });
  $("#bCopy").addEventListener("click", function () {
    var t = $("#bText"), btn = $("#bCopy");
    var done = function () { btn.textContent = "Đã chép"; setTimeout(function () { btn.textContent = "Chép dữ liệu"; }, 1400); };
    var fb = function () { t.focus(); t.select(); t.setSelectionRange(0, t.value.length); };
    try { navigator.clipboard.writeText(t.value).then(done, fb); } catch (e) { fb(); }
  });
  $("#bRestore").addEventListener("click", function () {
    var err = $("#bErr"); err.textContent = "";
    var parsed;
    try { parsed = JSON.parse($("#bText").value); } catch (e) { err.textContent = "Dữ liệu dán vào chưa đúng định dạng."; return; }
    var arr = Array.isArray(parsed) ? parsed : (parsed && parsed.jobs);
    if (!Array.isArray(arr)) { err.textContent = "Không tìm thấy danh sách lịch chụp trong dữ liệu này."; return; }
    var clean = arr.filter(function (x) { return x && typeof x === "object"; }).map(migrate);
    var byId = {}; jobs.forEach(function (j) { byId[j.id] = j; });
    clean.forEach(function (j) { byId[j.id] = j; });
    var before = jobs.slice();
    var merged = Object.keys(byId).map(function (k) { return byId[k]; });
    var kept = merged.filter(function (j) { return !expired(j); });
    jobs = kept;
    if (!persist()) { jobs = before; err.textContent = "Chưa lưu được dữ liệu khôi phục."; return; }
    var skipped = merged.length - kept.length;
    notice = skipped ? "Khôi phục xong. Bỏ qua " + skipped + " lịch đã hoàn thành quá " + KEEP_MONTHS + " tháng." : "";
    showNote();
    render();
    $("#bscrim").hidden = true;
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!$("#bscrim").hidden) $("#bscrim").hidden = true; else if (!$("#scrim").hidden) closeSheet();
  });

  /* Mở lại ứng dụng sau một đêm: chuyển lịch vừa xong sang Đã hoàn thành, xóa lịch quá hạn. */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    var n = purge();
    if (n) notice = "Đã tự xóa " + n + " lịch đã hoàn thành quá " + KEEP_MONTHS + " tháng.";
    showNote(); render();
  });

  /* ---------- Chia sẻ cho màn hình Lịch (calendar.js) ---------- */
  window.So = {
    jobs: function () { return jobs; },
    card: card,
    openSheet: openSheet,
    parseWhen: parseWhen,
    events: events,
    datesOf: function (j) {
      return events(j).map(function (e) { return { kind: e.kind === "Nạp Tài" ? "nap" : "cuoi", when: e.when }; });
    },
    el: el,
    money: money,
    remaining: remaining
  };

  /* ---------- Khởi động ---------- */
  load();
  var removed = purge();
  if (removed) notice = "Đã tự xóa " + removed + " lịch đã hoàn thành quá " + KEEP_MONTHS + " tháng.";
  if (needsSave && storageOk) persist();
  showNote();
  render();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
