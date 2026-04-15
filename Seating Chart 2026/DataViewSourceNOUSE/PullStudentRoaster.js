const roster = await fetch("./all_class_period_roster_2026_04_15.cleaned.json").then(r => r.json());

// get all sections
console.log(roster.sections);

// get period 3
const period3 = roster.sections.find(section => section.period === 3);

// get all student names in period 3
const names = period3.students.map(student => student.name);

// find a student by student number across all sections
const foundStudent = roster.sections
  .flatMap(section => section.students.map(student => ({
    ...student,
    period: section.period,
    courseTitle: section.courseTitle
  })))
  .find(student => student.studentNumber === "72398");

console.log(foundStudent);