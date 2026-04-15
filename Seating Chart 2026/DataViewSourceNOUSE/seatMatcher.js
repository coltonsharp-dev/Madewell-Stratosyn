// seatMatcher.js
// --------------------------------------------------
// PURPOSE
// Match handwritten seating-chart names to official roster data
// and enrich each seat assignment with:
// - studentNumber
// - rosterIndex
// - matchedRosterName
// - matchType
// - matchConfidence
//
// EXPECTED INPUTS
// 1. rosterData = full roster JSON object
// 2. seatingData = one period seating JSON object
//
// EXAMPLE USAGE
// const roster = await fetch("all_class_period_roster_2026_04_15.cleaned.json").then(r => r.json());
// const seating = await fetch("period_3_seating.json").then(r => r.json());
// const result = matchSeatingToRoster(roster, seating);
// console.log(result);
//
// --------------------------------------------------

// ---------- CONFIG ----------

// Global nickname / shorthand aliases.
// Add to this as you discover classroom-specific shorthand.
const NAME_ALIASES = {
  // general / known cases from your classes
  "maddy": "madelyn",
  "emmy": "emmy",
  "emilee": "emily",
  "conney": "conner",
  "joi": "joii",
  "joii": "joii",
  "jude": "juda",
  "jabril": "jibril",
  "abi": "abby",
  "abby": "abby",
  "nick": "nick",
  "nicky": "nic",
  "josy": "joseph",
  "josey": "joseph",
  "sam": "sammy",
  "kenny": "kenny",
  "lilian": "lilah",
  "zac": "zac",
  "jaxson": "jax",
  "austin l": "austin",
  "austin k": "austin",
  "cc": "cc",
  "c.c.": "cc",
  "gg": "gg",
  "g.g.": "gg",
  "to lin": "tolin",
  "to-lin": "tolin",
  "ping": "pinghung",
  "pinghung": "pinghung",
  "sriaikya": "sriaikya",
  "sofia a": "sofia",
  "evey": "evey",
  "marquez": "marquez",
  "preston": "preston",
  "nishita": "nishita",
  "millie": "millie",
  "harper": "harper",
  "sidra": "sidra",
  "legend": "legend",
  "joseph": "joseph",
  "violet": "violet",
  "nora": "nora",
  "rey": "rey",
  "rocky": "rocky",
  "destiny": "destiny",
  "guillermo": "guillermo",
  "hunter": "hunter",
  "ivy": "ivy",
  "avery": "avarie",
  "cameron": "cameron",
  "deborah": "deborah",
  "hayden": "hayden",
  "mason": "masyn",
  "randy": "ben",
  "faith": "faith",
  "nathan": "nathan",
  "grace": "grace",
  "reagan": "reagan",
  "ben": "ben",
  "harley": "harley",
  "sophia": "sophia"
};

// Optional period-specific overrides.
// Use this when a shorthand is ambiguous across periods.
const PERIOD_ALIASES = {
  1: {
    "sofia": ["allen sofia", "longoria solis sofia"],
    "emma": ["szager emmy"],
    "krish": []
  },
  3: {
    "nicky": ["riccelli nic nikki"],
    "austin": ["lynn austin", "kincaid austin"],
    "jaxson": ["zahlmann jax"]
  },
  4: {
    "nick": ["peter nick"],
    "zac": ["dunklin zac", "anderson zachary"]
  },
  5: {
    "keegan": [],
    "abi": ["pierce abby"],
    "joseph": ["caputo joseph"]
  },
  6: {
    "josey": [],
    "randy": ["simpson ben"],
    "ben": ["simpson ben"]
  }
};

// ---------- HELPERS ----------

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function safeString(value) {
  return (value ?? "").toString().trim();
}

function normalizeText(str) {
  return safeString(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip accents
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseName(str) {
  return normalizeText(str).replace(/\s+/g, " ").trim();
}

function extractRosterNameParts(fullRosterName) {
  // Example:
  // "Allen, Sofia L" -> last="Allen", first="Sofia", middle="L"
  const raw = safeString(fullRosterName);
  const [lastPart, restPart] = raw.split(",").map(s => safeString(s));
  const restTokens = collapseName(restPart).split(" ").filter(Boolean);

  const first = restTokens[0] || "";
  const middle = restTokens.slice(1).join(" ");
  const last = collapseName(lastPart);

  return {
    raw,
    first,
    middle,
    last,
    firstLast: [first, last].filter(Boolean).join(" "),
    lastFirst: [last, first].filter(Boolean).join(" "),
    allTokens: [first, middle, last].join(" ").trim()
  };
}

function canonicalizeStudent(student) {
  const parsed = extractRosterNameParts(student.name);

  return {
    ...student,
    _parsed: parsed,
    _first: parsed.first,
    _middle: parsed.middle,
    _last: parsed.last,
    _firstLast: parsed.firstLast,
    _lastFirst: parsed.lastFirst,
    _allTokens: parsed.allTokens
  };
}

function normalizeSeatName(name) {
  const normalized = collapseName(name);
  if (!normalized) return "";

  if (NAME_ALIASES[normalized]) {
    return collapseName(NAME_ALIASES[normalized]);
  }

  return normalized;
}

function tokenize(str) {
  return collapseName(str).split(" ").filter(Boolean);
}

function unique(arr) {
  return [...new Set(arr)];
}

function levenshtein(a, b) {
  const s = collapseName(a);
  const t = collapseName(b);

  const m = s.length;
  const n = t.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function similarityScore(a, b) {
  const aa = collapseName(a);
  const bb = collapseName(b);
  if (!aa || !bb) return 0;
  const dist = levenshtein(aa, bb);
  return 1 - dist / Math.max(aa.length, bb.length);
}

function tokenOverlapScore(a, b) {
  const ta = unique(tokenize(a));
  const tb = unique(tokenize(b));

  if (!ta.length || !tb.length) return 0;

  const aSet = new Set(ta);
  const bSet = new Set(tb);

  let overlap = 0;
  for (const token of aSet) {
    if (bSet.has(token)) overlap++;
  }

  return overlap / Math.max(aSet.size, bSet.size);
}

function buildStudentCandidateStrings(student) {
  const p = student._parsed;

  return unique([
    p.first,
    p.last,
    p.firstLast,
    p.lastFirst,
    p.allTokens,
    student.name
  ].map(collapseName).filter(Boolean));
}

function getPeriodSection(rosterData, period) {
  if (!rosterData?.sections || !Array.isArray(rosterData.sections)) {
    throw new Error("Invalid rosterData: missing sections array.");
  }

  const section = rosterData.sections.find(s => Number(s.period) === Number(period));
  if (!section) {
    throw new Error(`No roster section found for period ${period}.`);
  }

  return section;
}

function enrichSectionStudents(section) {
  return section.students.map((student, index) => ({
    ...canonicalizeStudent(student),
    rosterIndex: index + 1
  }));
}

function exactFirstNameMatch(seatName, students) {
  return students.filter(student => collapseName(student._first) === collapseName(seatName));
}

function exactAnyFieldMatch(seatName, students) {
  return students.filter(student => {
    const candidates = buildStudentCandidateStrings(student);
    return candidates.includes(collapseName(seatName));
  });
}

function aliasMatch(seatName, students, period) {
  const normalized = normalizeSeatName(seatName);
  const periodMap = PERIOD_ALIASES[period] || {};

  const directMatches = students.filter(student => {
    const candidates = buildStudentCandidateStrings(student);
    return candidates.includes(normalized);
  });

  if (directMatches.length) return directMatches;

  const periodAliasTargets = periodMap[collapseName(seatName)] || [];
  if (!periodAliasTargets.length) return [];

  return students.filter(student => {
    const searchable = collapseName(student.name);
    return periodAliasTargets.some(target => searchable.includes(collapseName(target)));
  });
}

function fuzzyMatch(seatName, students) {
  const target = normalizeSeatName(seatName);
  if (!target) return [];

  const scored = students.map(student => {
    const fields = buildStudentCandidateStrings(student);
    const fieldScores = fields.map(field => {
      const sim = similarityScore(target, field);
      const overlap = tokenOverlapScore(target, field);
      return Math.max(sim, overlap);
    });

    const score = Math.max(...fieldScores, 0);

    return {
      student,
      score
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.filter(x => x.score >= 0.70);
}

function chooseBestMatch(candidates, seatName) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const target = normalizeSeatName(seatName);

  const scored = candidates.map(student => {
    const fields = buildStudentCandidateStrings(student);
    const best = Math.max(
      ...fields.map(field => Math.max(
        similarityScore(target, field),
        tokenOverlapScore(target, field)
      )),
      0
    );

    return { student, best };
  });

  scored.sort((a, b) => b.best - a.best);

  if (scored.length > 1 && scored[0].best === scored[1].best) {
    return null;
  }

  return scored[0].student;
}

function isSeatEmpty(name) {
  const n = collapseName(name);
  return (
    !n ||
    n === "empty" ||
    n === "open" ||
    n === "vacant" ||
    n === "none" ||
    n === "null"
  );
}

// ---------- MAIN MATCHER ----------

function matchSingleSeat(seatAssignment, students, period) {
  const result = clone(seatAssignment);
  const originalName = safeString(seatAssignment.name || seatAssignment.studentName);

  if (isSeatEmpty(originalName)) {
    return {
      ...result,
      name: null,
      studentName: null,
      matchedRosterName: null,
      rosterIndex: null,
      studentNumber: null,
      matchType: "empty",
      matchConfidence: 1,
      needsReview: false,
      reviewReason: null
    };
  }

  // Keep one consistent public display field
  result.name = originalName;
  result.studentName = originalName;

  // 1) exact against any roster field
  let candidates = exactAnyFieldMatch(originalName, students);
  if (candidates.length === 1) {
    const student = candidates[0];
    return finalizeMatch(result, student, "exact", 1.0, false, null);
  }
  if (candidates.length > 1) {
    const chosen = chooseBestMatch(candidates, originalName);
    if (chosen) {
      return finalizeMatch(result, chosen, "exact_resolved", 0.95, false, null);
    }
    return finalizeUnmatched(result, "ambiguous exact match");
  }

  // 2) alias / nickname / period overrides
  candidates = aliasMatch(originalName, students, period);
  if (candidates.length === 1) {
    const student = candidates[0];
    return finalizeMatch(result, student, "alias", 0.93, false, null);
  }
  if (candidates.length > 1) {
    const chosen = chooseBestMatch(candidates, originalName);
    if (chosen) {
      return finalizeMatch(result, chosen, "alias_resolved", 0.88, true, "resolved from multiple alias matches");
    }
    return finalizeUnmatched(result, "ambiguous alias match");
  }

  // 3) exact first-name-only
  candidates = exactFirstNameMatch(originalName, students);
  if (candidates.length === 1) {
    const student = candidates[0];
    return finalizeMatch(result, student, "first_name", 0.85, false, null);
  }
  if (candidates.length > 1) {
    return finalizeUnmatched(result, "multiple students share same first name");
  }

  // 4) fuzzy
  const fuzzyCandidates = fuzzyMatch(originalName, students);
  if (fuzzyCandidates.length === 1) {
    return finalizeMatch(result, fuzzyCandidates[0].student, "fuzzy", fuzzyCandidates[0].score, true, "fuzzy match");
  }
  if (fuzzyCandidates.length > 1) {
    const best = fuzzyCandidates[0];
    const second = fuzzyCandidates[1];

    // Only auto-pick if separation is meaningful
    if (best.score - second.score >= 0.08) {
      return finalizeMatch(result, best.student, "fuzzy_resolved", best.score, true, "fuzzy resolved from multiple candidates");
    }

    return finalizeUnmatched(result, "ambiguous fuzzy match");
  }

  return finalizeUnmatched(result, "no roster match found");
}

function finalizeMatch(base, student, matchType, confidence, needsReview, reviewReason) {
  return {
    ...base,
    matchedRosterName: student.name,
    rosterIndex: student.rosterIndex,
    studentNumber: student.studentNumber,
    matchType,
    matchConfidence: Number(confidence.toFixed(3)),
    needsReview,
    reviewReason
  };
}

function finalizeUnmatched(base, reason) {
  return {
    ...base,
    matchedRosterName: null,
    rosterIndex: null,
    studentNumber: null,
    matchType: "unmatched",
    matchConfidence: 0,
    needsReview: true,
    reviewReason: reason
  };
}

function detectConflicts(assignments) {
  const warnings = [];
  const bySeat = new Map();
  const byStudentNumber = new Map();

  for (const row of assignments) {
    if (row.seatId) {
      if (bySeat.has(row.seatId)) {
        warnings.push({
          type: "duplicateSeatId",
          seatId: row.seatId,
          message: `Seat ${row.seatId} appears multiple times.`
        });
      } else {
        bySeat.set(row.seatId, row);
      }
    }

    if (row.studentNumber) {
      if (!byStudentNumber.has(row.studentNumber)) {
        byStudentNumber.set(row.studentNumber, []);
      }
      byStudentNumber.get(row.studentNumber).push(row);
    }
  }

  for (const [studentNumber, rows] of byStudentNumber.entries()) {
    if (rows.length > 1) {
      warnings.push({
        type: "duplicateStudentAssignment",
        studentNumber,
        matchedRosterName: rows[0].matchedRosterName || rows[0].name || null,
        seatIds: rows.map(r => r.seatId),
        message: `Student ${studentNumber} is assigned to multiple seats: ${rows.map(r => r.seatId).join(", ")}`
      });
    }
  }

  return warnings;
}

function buildSummary(assignments) {
  const total = assignments.length;
  const matched = assignments.filter(a => a.studentNumber).length;
  const unmatched = assignments.filter(a => a.matchType === "unmatched").length;
  const empty = assignments.filter(a => a.matchType === "empty").length;
  const review = assignments.filter(a => a.needsReview).length;

  return {
    totalSeatsProcessed: total,
    matchedSeats: matched,
    unmatchedSeats: unmatched,
    emptySeats: empty,
    reviewNeeded: review
  };
}

function matchSeatingToRoster(rosterData, seatingData) {
  if (!seatingData || typeof seatingData !== "object") {
    throw new Error("Invalid seatingData.");
  }

  const period = Number(seatingData.period);
  if (!period) {
    throw new Error("seatingData.period is required.");
  }

  const section = getPeriodSection(rosterData, period);
  const students = enrichSectionStudents(section);

  const assignments = Array.isArray(seatingData.assignments)
    ? seatingData.assignments
    : [];

  const matchedAssignments = assignments.map(assignment =>
    matchSingleSeat(assignment, students, period)
  );

  const warnings = detectConflicts(matchedAssignments);
  const summary = buildSummary(matchedAssignments);

  return {
    period,
    courseTitle: section.courseTitle,
    room: section.room,
    totalRosterStudents: section.students.length,
    summary,
    warnings,
    assignments: matchedAssignments
  };
}

// ---------- OPTIONAL HELPERS ----------

function buildMinimalSeatMap(matchedResult) {
  return {
    period: matchedResult.period,
    assignments: matchedResult.assignments.map(row => ({
      seatId: row.seatId,
      studentNumber: row.studentNumber
    }))
  };
}

function buildReviewList(matchedResult) {
  return matchedResult.assignments
    .filter(row => row.needsReview)
    .map(row => ({
      seatId: row.seatId,
      enteredName: row.name,
      reviewReason: row.reviewReason,
      matchType: row.matchType,
      matchConfidence: row.matchConfidence
    }));
}

// ---------- EXPORTS ----------

export {
  matchSeatingToRoster,
  buildMinimalSeatMap,
  buildReviewList
};