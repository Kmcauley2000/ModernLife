const SAVE_KEY = "modern-world-life-save";
const SAVE_VERSION = 3;

const LIFE_STAGES = [
  { key: "infant", label: "Infant", min: 0, max: 4 },
  { key: "child", label: "Child", min: 5, max: 12 },
  { key: "teen", label: "Teen", min: 13, max: 17 },
  { key: "young-adult", label: "Young Adult", min: 18, max: 25 },
  { key: "adult", label: "Adult", min: 26, max: 64 },
  { key: "elder", label: "Elder", min: 65, max: 120 }
];

export const xpToLevel = lvl => 20 + lvl * 10;

export const BASE_STATE = {
  saveVersion: SAVE_VERSION,
  age: 0,
  stage: "infant",
  level: 1,
  xp: 0,
  health: 95,
  energy: 100,
  focus: 35,
  happiness: 60,
  stress: 8,
  cash: 0,
  rep: 0,
  career: 0,
  education: 0,
  location: "home",
  inventory: ["Baby Blanket"],
  achievements: [],
  quests: [
    { id: "first-day-school", name: "Start School", target: 1, progress: 0, reward: "+8 Education", done: false },
    { id: "graduate-school", name: "Graduate High School", target: 1, progress: 0, reward: "+15 Rep", done: false },
    { id: "first-job", name: "Get First Real Job", target: 1, progress: 0, reward: "$120", done: false },
    { id: "career-build", name: "Reach 60 Career", target: 60, progress: 0, reward: "Career Momentum Badge", done: false }
  ],
  stats: { yearsLived: 0 }
};

const clamp = (v, min = 0, max = 120) => Math.max(min, Math.min(max, v));
const clone = obj => structuredClone(obj);

const getStageFromAge = age => LIFE_STAGES.find(s => age >= s.min && age <= s.max) || LIFE_STAGES[LIFE_STAGES.length - 1];

export class GameEngine {
  constructor(randomFn = Math.random) {
    this.random = randomFn;
    this.state = clone(BASE_STATE);
    this.logs = [];
    this.locations = this.getLocationsForStage(this.state.stage);
  }

  log(message, cls = "") {
    this.logs.unshift({ message, cls });
  }

  unlockAchievement(name, description) {
    if (this.state.achievements.some(a => a.name === name)) return;
    this.state.achievements.push({ name, description, age: this.state.age });
    this.log(`🏆 Achievement unlocked: ${name}`, "good");
  }

  getQuest(id) {
    return this.state.quests.find(q => q.id === id);
  }

  completeQuest(id) {
    const q = this.getQuest(id);
    if (!q || q.done) return;
    q.progress = q.target;
    q.done = true;
    if (id === "first-day-school") this.adjust({ education: +8, xp: +8 }, "You settled into school life.", "good", false);
    if (id === "graduate-school") this.adjust({ rep: +15, xp: +12 }, "You graduated high school.", "good", false);
    if (id === "first-job") this.adjust({ cash: +120, career: +10, xp: +12 }, "You landed your first real job.", "good", false);
    if (id === "career-build") {
      this.addItem("Career Momentum Badge");
      this.adjust({ rep: +15, xp: +12 }, "You built a serious career reputation.", "good", false);
    }
  }

  trackCareerQuest() {
    const q = this.getQuest("career-build");
    if (!q || q.done) return;
    q.progress = Math.min(q.target, this.state.career);
    if (q.progress >= q.target) this.completeQuest("career-build");
  }

  addItem(item) {
    if (!this.state.inventory.includes(item)) {
      this.state.inventory.push(item);
      this.log(`Item acquired: ${item}.`, "good");
    }
  }

  gainXp(amount) {
    this.state.xp += amount;
    while (this.state.xp >= xpToLevel(this.state.level)) {
      this.state.xp -= xpToLevel(this.state.level);
      this.state.level += 1;
      this.state.health = clamp(this.state.health + 4);
      this.state.energy = clamp(this.state.energy + 4);
      this.state.focus = clamp(this.state.focus + 4);
      this.log(`⚡ Growth level up: ${this.state.level}.`, "good");
    }
  }

  adjust(delta, msg = "", cls = "good", runConsequences = true) {
    for (const [key, value] of Object.entries(delta)) {
      if (key === "xp") continue;
      if (typeof this.state[key] === "number") this.state[key] += value;
    }

    this.state.health = clamp(this.state.health);
    this.state.energy = clamp(this.state.energy);
    this.state.focus = clamp(this.state.focus);
    this.state.happiness = clamp(this.state.happiness);
    this.state.stress = clamp(this.state.stress);
    this.state.cash = Math.max(0, Math.round(this.state.cash));
    this.state.rep = Math.max(0, Math.round(this.state.rep));
    this.state.career = Math.max(0, Math.round(this.state.career));
    this.state.education = Math.max(0, Math.round(this.state.education));

    if (delta.xp) this.gainXp(delta.xp);
    if (msg) this.log(msg, cls);

    this.trackCareerQuest();
    if (runConsequences) this.passiveConsequences();
  }

  passiveConsequences() {
    if (this.state.stress > 95) {
      this.state.health = clamp(this.state.health - 8);
      this.state.happiness = clamp(this.state.happiness - 10);
      this.log("Burnout is damaging your health.", "bad");
    }
    if (this.state.energy < 15) {
      this.state.focus = clamp(this.state.focus - 7);
      this.log("Low energy hurt your focus.", "warn");
    }
    if (this.state.age >= 18 && this.state.cash >= 2000) {
      this.unlockAchievement("Financial Base", "Saved over $2000 in adulthood.");
    }
  }

  setLocation(key) {
    this.state.location = key;
  }

  randomLifeEvent() {
    const roll = this.random();
    if (roll > 0.92) {
      this.adjust({ happiness: +8, rep: +4, xp: +6 }, "A great life moment boosted your confidence.", "good");
    } else if (roll < 0.1) {
      this.adjust({ stress: +8, happiness: -5, health: -3 }, "A tough year brought extra pressure.", "bad");
    }
  }

  stageTransitionIfNeeded() {
    const stage = getStageFromAge(this.state.age);
    if (stage.key === this.state.stage) return;

    this.state.stage = stage.key;
    this.locations = this.getLocationsForStage(stage.key);
    this.state.location = Object.keys(this.locations)[0];
    this.log(`New life stage: ${stage.label}.`, "good");

    if (stage.key === "child") {
      this.completeQuest("first-day-school");
      this.addItem("School Backpack");
    }
    if (stage.key === "young-adult") {
      if (this.state.education >= 45) this.completeQuest("graduate-school");
      this.addItem("Resume");
    }
    if (stage.key === "adult") {
      this.completeQuest("first-job");
    }
    if (stage.key === "elder") {
      this.unlockAchievement("Long Life", "Reached elder years.");
    }
  }

  advanceCycle() {
    this.state.age += 1;
    this.state.stats.yearsLived += 1;

    this.adjust({
      energy: -4,
      health: this.state.age > 60 ? -2 : -1,
      stress: +2,
      happiness: this.state.age < 18 ? +1 : 0,
      cash: this.state.age >= 18 ? +20 : 0,
      xp: 5
    }, `You lived through age ${this.state.age}.`, "warn", false);

    this.stageTransitionIfNeeded();
    this.randomLifeEvent();
    this.passiveConsequences();

    if (this.state.age === 18) this.unlockAchievement("Adult Life Begins", "Entered adulthood.");
    if (this.state.age === 30) this.unlockAchievement("30-Year Milestone", "Reached age 30.");
    if (this.state.age === 50) this.unlockAchievement("Half Century", "Reached age 50.");
  }

  newRun() {
    this.state = clone(BASE_STATE);
    this.locations = this.getLocationsForStage(this.state.stage);
    this.logs = [];
    this.log("New life started: you are born into the modern world.", "good");
  }

  serialize() {
    return JSON.stringify({ ...this.state, saveVersion: SAVE_VERSION });
  }

  loadFromSerialized(raw) {
    const parsed = JSON.parse(raw);
    const migrated = migrateSave(parsed);
    this.state = { ...clone(BASE_STATE), ...migrated };
    this.locations = this.getLocationsForStage(this.state.stage);
    this.log("Save loaded successfully.", "good");
  }

  getLocationsForStage(stage) {
    const common = {
      home: {
        title: "Home",
        text: "Your foundation for rest, growth, and family life.",
        actions: [
          { label: "Rest", run: () => this.adjust({ energy: +14, health: +5, stress: -5, happiness: +4, xp: +3 }, "You recharged at home.") },
          { label: "Talk with Family", run: () => this.adjust({ happiness: +8, stress: -4, rep: +1, xp: +3 }, "Family support helped your mindset.") }
        ]
      }
    };

    const byStage = {
      infant: {
        playroom: {
          title: "Playroom",
          text: "Early growth years full of tiny milestones.",
          actions: [
            { label: "Learn to Crawl", run: () => this.adjust({ focus: +5, health: +4, xp: +6 }, "You hit a baby milestone.") },
            { label: "Story Time", run: () => this.adjust({ focus: +6, happiness: +6, education: +2, xp: +6 }, "Story time boosted early learning.") }
          ]
        }
      },
      child: {
        school: {
          title: "School",
          text: "Learn basics, make friends, and build habits.",
          actions: [
            { label: "Attend Class", run: () => this.adjust({ education: +6, focus: +4, stress: +2, xp: +8 }, "You learned important basics.") },
            { label: "Join Club", run: () => this.adjust({ rep: +4, happiness: +5, energy: -4, xp: +6 }, "You made new friends.") }
          ]
        },
        park: {
          title: "Neighborhood Park",
          text: "Play, socialize, and stay active.",
          actions: [
            { label: "Play Sports", run: () => this.adjust({ health: +6, happiness: +6, energy: -6, xp: +6 }, "You stayed active and had fun.") }
          ]
        }
      },
      teen: {
        highschool: {
          title: "High School",
          text: "Prepare for exams, life choices, and responsibility.",
          actions: [
            { label: "Study for Exams", run: () => this.adjust({ education: +8, focus: +7, stress: +4, xp: +10 }, "Exam prep paid off.") },
            { label: "Part-time Shift", run: () => this.adjust({ cash: +45, career: +5, energy: -7, stress: +2, xp: +9 }, "You gained first work experience.") }
          ]
        },
        community: {
          title: "Community Center",
          text: "Volunteer and build your reputation.",
          actions: [
            { label: "Volunteer", run: () => this.adjust({ rep: +8, happiness: +5, energy: -5, xp: +8 }, "Your community trusts you more.") }
          ]
        }
      },
      "young-adult": {
        campus: {
          title: "College / Training",
          text: "Build career skills and professional direction.",
          actions: [
            { label: "Attend Course", run: () => this.adjust({ education: +9, focus: +6, stress: +3, xp: +10 }, "You gained practical skills.") },
            { label: "Internship", run: () => this.adjust({ cash: +85, career: +8, rep: +3, energy: -8, xp: +11 }, "You built your resume.") }
          ]
        },
        office: {
          title: "Starter Job",
          text: "Take your first serious career steps.",
          actions: [
            { label: "Work Shift", run: () => this.adjust({ cash: +110, career: +10, stress: +4, energy: -8, xp: +10 }, "You completed solid work this year.") },
            { label: "Network", run: () => this.adjust({ rep: +8, career: +4, cash: -10, xp: +8 }, "You grew your professional network.") }
          ]
        }
      },
      adult: {
        workplace: {
          title: "Career",
          text: "Advance your career and life stability.",
          actions: [
            { label: "Deliver Major Project", run: () => this.adjust({ cash: +180, career: +12, stress: +5, energy: -10, xp: +12 }, "A major project moved your career forward.") },
            { label: "Mentor Others", run: () => this.adjust({ rep: +10, career: +6, happiness: +6, xp: +9 }, "Mentoring improved your impact.") }
          ]
        },
        family: {
          title: "Family Life",
          text: "Balance success with meaningful relationships.",
          actions: [
            { label: "Family Time", run: () => this.adjust({ happiness: +10, stress: -7, energy: +4, xp: +7 }, "You prioritized what matters.") }
          ]
        }
      },
      elder: {
        retirement: {
          title: "Retirement",
          text: "Reflect, mentor, and enjoy a slower pace.",
          actions: [
            { label: "Mentor Youth", run: () => this.adjust({ rep: +9, happiness: +8, stress: -5, xp: +7 }, "Your wisdom helped the next generation.") },
            { label: "Health Routine", run: () => this.adjust({ health: +8, energy: +5, stress: -6, xp: +6 }, "You invested in long-term health.") }
          ]
        }
      }
    };

    return {
      ...common,
      ...(byStage[stage] || {})
    };
  }
}

export function migrateSave(parsed) {
  const next = { ...parsed };

  if (!next.saveVersion || next.saveVersion < 3) {
    next.saveVersion = 3;
    next.age = typeof next.age === "number" ? next.age : 0;
    next.stage = next.stage || getStageFromAge(next.age).key;
    next.happiness = typeof next.happiness === "number" ? next.happiness : 60;
    next.education = typeof next.education === "number" ? next.education : 0;
    if (!next.stats) next.stats = { yearsLived: next.age || 0 };
    if (!Array.isArray(next.quests)) next.quests = clone(BASE_STATE.quests);
  }

  return next;
}

function bindUI() {
  const el = id => document.getElementById(id);
  const ui = {
    level: el("level"), xpBar: el("xpBar"), xpText: el("xpText"),
    health: el("health"), healthBar: el("healthBar"),
    energy: el("energy"), energyBar: el("energyBar"),
    focus: el("focus"), focusBar: el("focusBar"),
    cash: el("cash"), rep: el("rep"), career: el("career"), stress: el("stress"), stressBar: el("stressBar"),
    dayLabel: el("dayLabel"), cycleLabel: el("cycleLabel"), routes: el("routes"),
    sceneTitle: el("sceneTitle"), sceneText: el("sceneText"), actions: el("actions"),
    questList: el("questList"), inventory: el("inventory"), achievements: el("achievements"), log: el("log")
  };

  const engine = new GameEngine();
  const tabs = Array.from(document.querySelectorAll("[data-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-panel]"));

  const activateTab = tabName => {
    tabs.forEach(btn => btn.classList.toggle("is-active", btn.dataset.tab === tabName));
    panels.forEach(panel => panel.classList.toggle("hidden", panel.dataset.panel !== tabName));
  };

  tabs.forEach(btn => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));

  const renderScene = () => {
    const loc = engine.locations[engine.state.location];
    ui.sceneTitle.textContent = `${loc.title} (${getStageFromAge(engine.state.age).label})`;
    ui.sceneText.textContent = loc.text;

    ui.actions.innerHTML = "";
    loc.actions.forEach(action => {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.onclick = () => {
        action.run();
        renderAll();
      };
      ui.actions.appendChild(b);
    });

    ui.routes.innerHTML = "";
    for (const [key, location] of Object.entries(engine.locations)) {
      const b = document.createElement("button");
      b.textContent = location.title;
      if (key === engine.state.location) b.classList.add("primary");
      b.onclick = () => {
        engine.setLocation(key);
        renderAll();
      };
      ui.routes.appendChild(b);
    }
  };

  const renderAll = () => {
    const s = engine.state;
    const stage = getStageFromAge(s.age);
    const need = xpToLevel(s.level);

    ui.level.textContent = s.level;
    ui.health.textContent = s.health;
    ui.energy.textContent = s.energy;
    ui.focus.textContent = s.focus;
    ui.cash.textContent = s.cash;
    ui.rep.textContent = s.rep;
    ui.career.textContent = s.career;
    ui.stress.textContent = s.stress;
    ui.dayLabel.textContent = s.age;
    ui.cycleLabel.textContent = stage.label;

    ui.xpText.textContent = `${s.xp}/${need}`;
    ui.xpBar.style.width = `${(s.xp / need) * 100}%`;
    ui.healthBar.style.width = `${(s.health / 120) * 100}%`;
    ui.energyBar.style.width = `${(s.energy / 120) * 100}%`;
    ui.focusBar.style.width = `${(s.focus / 120) * 100}%`;
    ui.stressBar.style.width = `${(s.stress / 120) * 100}%`;

    renderScene();

    ui.questList.innerHTML = "";
    s.quests.forEach(q => {
      const li = document.createElement("li");
      li.className = "quest";
      li.innerHTML = `<strong>${q.done ? "✅" : "🧭"} ${q.name}</strong><small>${q.progress}/${q.target} • Reward: ${q.reward}</small>`;
      ui.questList.appendChild(li);
    });

    ui.inventory.innerHTML = "";
    s.inventory.slice(-10).forEach(item => {
      const li = document.createElement("li");
      li.className = "inv-item";
      li.textContent = item;
      ui.inventory.appendChild(li);
    });

    ui.achievements.innerHTML = "";
    if (!s.achievements.length) {
      const li = document.createElement("li");
      li.className = "ach";
      li.textContent = "No achievements yet.";
      ui.achievements.appendChild(li);
    } else {
      s.achievements.slice(-8).reverse().forEach(a => {
        const li = document.createElement("li");
        li.className = "ach";
        li.innerHTML = `<strong>🏆 ${a.name}</strong><small>${a.description} (Age ${a.age})</small>`;
        ui.achievements.appendChild(li);
      });
    }

    ui.log.innerHTML = "";
    engine.logs.slice(0, 40).forEach(entry => {
      const p = document.createElement("p");
      p.className = entry.cls;
      p.textContent = `• ${entry.message}`;
      ui.log.appendChild(p);
    });
  };

  el("nextCycle").onclick = () => {
    engine.advanceCycle();
    renderAll();
  };
  el("restBtn").onclick = () => {
    engine.adjust({ energy: +16, health: +5, stress: -5, happiness: +5 }, "You took a restful break.");
    renderAll();
  };
  el("meditateBtn").onclick = () => {
    engine.adjust({ focus: +10, stress: -8, happiness: +4, xp: +4 }, "You centered yourself and gained clarity.");
    renderAll();
  };
  el("saveBtn").onclick = () => {
    localStorage.setItem(SAVE_KEY, engine.serialize());
    engine.log("Game saved.", "good");
    renderAll();
  };
  el("loadBtn").onclick = () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      engine.log("No save file found.", "warn");
    } else {
      try {
        engine.loadFromSerialized(raw);
      } catch {
        engine.log("Save file corrupted.", "bad");
      }
    }
    renderAll();
  };
  el("newRunBtn").onclick = () => {
    if (!confirm("Start a brand new life?")) return;
    engine.newRun();
    renderAll();
  };

  engine.log("You were born. Build your life from childhood to adulthood.", "good");
  engine.log("Tip: focus on education early, then build career in adulthood.", "warn");
  activateTab("game");
  renderAll();
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", bindUI);
}
