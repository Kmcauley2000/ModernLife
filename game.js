const SAVE_KEY = "modern-world-life-save";
const SAVE_VERSION = 2;
const CYCLES = ["Morning", "Afternoon", "Evening", "Night"];

export const xpToLevel = lvl => 20 + lvl * 12;

export const BASE_STATE = {
  saveVersion: SAVE_VERSION,
  level: 1,
  xp: 0,
  health: 100,
  energy: 100,
  focus: 65,
  cash: 60,
  rep: 0,
  career: 0,
  stress: 22,
  day: 1,
  cycle: 0,
  location: "apartment",
  inventory: ["Phone", "Transit Card", "Laptop"],
  achievements: [],
  quests: [
    { id: "first-gig", name: "Finish 1 paid gig", target: 1, progress: 0, reward: "$30 + 8 XP", done: false },
    { id: "wellness", name: "Reduce stress below 20", target: 1, progress: 0, reward: "+12 Rep", done: false },
    { id: "network", name: "Gain 25 reputation", target: 25, progress: 0, reward: "Freelancer Badge", done: false }
  ],
  stats: { wins: 0, losses: 0 }
};

const clone = obj => structuredClone(obj);
const clamp = (v, min = 0, max = 100) => Math.max(min, Math.min(max, v));

export class GameEngine {
  constructor(randomFn = Math.random) {
    this.random = randomFn;
    this.state = clone(BASE_STATE);
    this.logs = [];
    this.locations = this.createLocations();
  }

  log(message, cls = "") {
    this.logs.unshift({ message, cls });
  }

  getQuest(id) {
    return this.state.quests.find(q => q.id === id);
  }

  trackQuest(id, amount = 1) {
    const q = this.getQuest(id);
    if (!q || q.done || amount <= 0) return;
    q.progress = Math.min(q.target, q.progress + amount);
    if (q.progress >= q.target) {
      q.done = true;
      this.claimQuestReward(q);
    }
  }

  claimQuestReward(q) {
    if (q.id === "first-gig") {
      this.adjust({ cash: +30, xp: +8 }, `Quest complete: ${q.name}. Reward claimed.`, "good", false);
    } else if (q.id === "wellness") {
      this.adjust({ rep: +12, xp: +8 }, `Quest complete: ${q.name}. Reward claimed.`, "good", false);
    } else if (q.id === "network") {
      this.addItem("Freelancer Badge");
      this.adjust({ xp: +10 }, `Quest complete: ${q.name}. Reward claimed.`, "good", false);
    }
    this.unlockAchievement(`Quest: ${q.name}`, "Completed a major objective.");
  }

  addItem(item) {
    if (!this.state.inventory.includes(item)) {
      this.state.inventory.push(item);
      this.log(`Item acquired: ${item}.`, "good");
    }
  }

  unlockAchievement(name, description) {
    if (this.state.achievements.some(a => a.name === name)) return;
    this.state.achievements.push({ name, description, day: this.state.day });
    this.log(`🏆 Achievement unlocked: ${name}`, "good");
  }

  gainXp(amount) {
    this.state.xp += amount;
    while (this.state.xp >= xpToLevel(this.state.level)) {
      this.state.xp -= xpToLevel(this.state.level);
      this.state.level += 1;
      this.state.health = clamp(this.state.health + 9, 0, 120);
      this.state.focus = clamp(this.state.focus + 7, 0, 120);
      this.state.energy = clamp(this.state.energy + 6, 0, 120);
      this.state.rep += 2;
      this.log(`⚡ Level up! You are now level ${this.state.level}.`, "good");
    }
  }

  adjust(delta, msg, cls = "good", runConsequences = true) {
    const beforeRep = this.state.rep;

    for (const [key, value] of Object.entries(delta)) {
      if (key === "xp") continue;
      if (typeof this.state[key] === "number") this.state[key] += value;
    }

    this.state.health = clamp(this.state.health, 0, 120);
    this.state.energy = clamp(this.state.energy, 0, 120);
    this.state.focus = clamp(this.state.focus, 0, 120);
    this.state.stress = clamp(this.state.stress, 0, 120);
    this.state.cash = Math.max(0, Math.round(this.state.cash));
    this.state.rep = Math.max(0, Math.round(this.state.rep));
    this.state.career = Math.max(0, Math.round(this.state.career));

    if (delta.xp) this.gainXp(delta.xp);
    if (msg) this.log(msg, cls);

    if (this.state.stress < 20) this.trackQuest("wellness", 1);
    const repGained = Math.max(0, this.state.rep - beforeRep);
    this.trackQuest("network", repGained);

    if (runConsequences) this.passiveConsequences();
  }

  passiveConsequences() {
    if (this.state.stress > 95) {
      this.state.health = clamp(this.state.health - 10, 0, 120);
      this.state.focus = clamp(this.state.focus - 12, 0, 120);
      this.log("Stress overload hurt your health and focus.", "bad");
    }
    if (this.state.energy <= 8) {
      this.state.focus = clamp(this.state.focus - 8, 0, 120);
      this.log("Low energy reduced focus.", "warn");
    }
    if (this.state.health <= 0) this.log("You burned out completely. Start a new run.", "bad");
    if (this.state.career >= 80) this.unlockAchievement("Career Momentum", "Reached 80 career points.");
    if (this.state.cash >= 500) this.unlockAchievement("Rainy Day Fund", "Saved over $500.");
  }

  encounter(name, minDiff, maxDiff, successDelta, failDelta) {
    if (this.state.health <= 0) return this.log("You need recovery before conflicts.", "warn");
    const difficulty = Math.floor(this.random() * (maxDiff - minDiff + 1)) + minDiff;
    const power = this.state.level * 8 + this.state.rep * 0.65 + this.state.focus * 0.25 + this.state.career * 0.2;
    if (power >= difficulty) {
      this.state.stats.wins += 1;
      this.adjust(successDelta, `You won the encounter with ${name}.`, "good");
    } else {
      this.state.stats.losses += 1;
      this.adjust(failDelta, `${name} got the upper hand.`, "bad");
    }
    if (this.state.stats.wins >= 8) this.unlockAchievement("Street Smart", "Won 8 encounters.");
  }

  purchase(item, cost, delta, description) {
    if (this.state.cash < cost) return this.log("Not enough cash for that purchase.", "warn");
    this.state.cash -= cost;
    this.addItem(item);
    this.adjust({ ...delta, xp: 3 }, `Purchased ${item}. ${description}`);
  }

  dailyTick() {
    const rent = 18;
    this.state.cash = Math.max(0, this.state.cash - rent);
    this.state.stress = clamp(this.state.stress + 4, 0, 120);
    this.state.energy = clamp(this.state.energy - 4, 0, 120);
    this.log(`Day ${this.state.day} started. Daily costs paid: $${rent}.`, "warn");
    if (this.state.day >= 10) this.unlockAchievement("10-Day Survivor", "Made it to day 10.");
  }

  randomEvent() {
    const roll = this.random();
    if (roll > 0.86) {
      this.adjust({ cash: +35, rep: +6, xp: +9 }, "A viral post boosted your profile overnight.", "good");
    } else if (roll < 0.12) {
      this.adjust({ cash: -20, stress: +10, health: -5 }, "Unexpected bill hit your budget.", "bad");
    }
  }

  advanceCycle() {
    this.state.cycle += 1;
    if (this.state.cycle >= CYCLES.length) {
      this.state.cycle = 0;
      this.state.day += 1;
      this.dailyTick();
    }
    this.adjust({ energy: -5, stress: +2 }, `Time advanced to ${CYCLES[this.state.cycle]}.`, "warn");
    this.randomEvent();
  }

  setLocation(key) { this.state.location = key; }

  newRun() {
    this.state = clone(BASE_STATE);
    this.logs = [];
    this.log("New run started. Welcome back to the city.", "good");
  }

  serialize() {
    return JSON.stringify({ ...this.state, saveVersion: SAVE_VERSION });
  }

  loadFromSerialized(raw) {
    const parsed = JSON.parse(raw);
    const migrated = migrateSave(parsed);
    this.state = { ...clone(BASE_STATE), ...migrated };
    this.log("Save loaded successfully.", "good");
  }

  createLocations() {
    return {
      apartment: {
        title: "Apartment",
        text: "Your base. Recover, budget, and plan tomorrow.",
        actions: [
          { label: "Cook Meal", run: () => this.adjust({ cash: -8, health: +9, energy: +6, stress: -4, xp: +4 }, "Home-cooked meal restored your mood.") },
          {
            label: "Side Hustle Online", run: () => {
              if (this.random() > 0.7) {
                this.adjust({ cash: +38, career: +10, energy: -12, focus: -7, xp: +10 }, "A premium client paid same day.");
              } else {
                this.adjust({ cash: +18, career: +5, energy: -8, focus: -4, xp: +6 }, "Completed a routine remote task.");
              }
              this.trackQuest("first-gig", 1);
            }
          },
          { label: "Budget & Plan", run: () => this.adjust({ focus: +10, stress: -6, xp: +5 }, "You organized your finances and priorities.") }
        ]
      },
      downtown: {
        title: "Downtown",
        text: "Crowded, fast, and full of opportunity.",
        actions: [
          {
            label: "Gig Delivery", run: () => {
              if (this.state.energy < 15) return this.log("Too exhausted for delivery. Rest first.", "warn");
              const tip = this.random() > 0.65 ? 20 : 8;
              this.adjust({ cash: 22 + tip, energy: -15, stress: +5, rep: +4, xp: +8 }, `Gig complete. Tips earned: $${tip}.`);
              this.trackQuest("first-gig", 1);
            }
          },
          { label: "Help Stranger", run: () => this.adjust({ rep: +9, energy: -5, stress: -2, xp: +6 }, "People noticed your kindness.") },
          { label: "Confront Harasser", run: () => this.encounter("Harasser", 28, 50, { rep: +11, cash: +10 }, { health: -16, stress: +10 }) }
        ]
      },
      cowork: {
        title: "Cowork Hub",
        text: "Keyboards click. Coffee flows. Deadlines approach.",
        actions: [
          {
            label: "Deep Work Sprint", run: () => {
              const quality = this.random() + (this.state.focus / 150);
              if (quality > 1.1) {
                this.adjust({ cash: +42, career: +12, energy: -14, stress: +4, xp: +14 }, "Exceptional output landed a bonus contract.");
              } else {
                this.adjust({ cash: +20, career: +7, energy: -10, stress: +3, xp: +8 }, "Solid progress delivered on time.");
              }
            }
          },
          { label: "Network Event", run: () => this.adjust({ rep: +10, cash: -7, focus: -2, xp: +8 }, "You expanded your professional network.") },
          {
            label: "Pitch Product", run: () => {
              const score = this.random() * 100 + this.state.career * 0.5 + this.state.rep * 0.3;
              if (score > 95) {
                this.adjust({ cash: +95, career: +20, rep: +12, energy: -16, xp: +24 }, "Your pitch got funded. Huge leap forward.");
                this.addItem("Prototype Tablet");
              } else if (score > 70) {
                this.adjust({ cash: +35, career: +11, rep: +6, energy: -12, xp: +14 }, "Promising pitch. Follow-up meetings scheduled.");
              } else {
                this.adjust({ cash: -10, stress: +9, energy: -8, xp: +6 }, "Pitch flopped, but feedback was useful.", "warn");
              }
            }
          }
        ]
      },
      gym: {
        title: "Gym",
        text: "Train now, perform better everywhere else.",
        actions: [
          { label: "Strength Session", run: () => this.adjust({ health: +8, energy: -13, stress: -5, xp: +9 }, "You finished a focused training block.") },
          { label: "Cardio Run", run: () => this.adjust({ health: +6, energy: -10, focus: +8, stress: -7, xp: +8 }, "Cardio improved your stamina and clarity.") },
          { label: "Sparring", run: () => this.encounter("Sparring Partner", 22, 46, { rep: +8, career: +3, xp: +7 }, { health: -12, stress: +5 }) }
        ]
      },
      market: {
        title: "Market District",
        text: "A maze of stalls, street food, and side deals.",
        actions: [
          { label: "Buy Energy Drink ($9)", run: () => this.purchase("Energy Drink", 9, { energy: +16, stress: +2 }, "Quick boost, slight crash risk.") },
          { label: "Buy Journal ($14)", run: () => this.purchase("Journal", 14, { focus: +10, stress: -4 }, "Writing helps you process the day.") },
          {
            label: "Flip Old Tech", run: () => {
              if (this.random() > 0.6) {
                this.adjust({ cash: +30, rep: +4, xp: +7 }, "Great flip. You read the market right.");
              } else {
                this.adjust({ cash: +10, stress: +2, xp: +4 }, "Small profit after haggling.", "warn");
              }
            }
          }
        ]
      },
      subway: {
        title: "Subway",
        text: "Fast movement, random encounters, and real city tension.",
        actions: [
          { label: "Read During Commute", run: () => this.adjust({ focus: +12, energy: -3, xp: +6 }, "Tiny learning session complete.") },
          { label: "Defend a Commuter", run: () => this.encounter("Pickpocket", 30, 55, { rep: +14, cash: +14, xp: +12 }, { health: -18, cash: -8, stress: +9 }) },
          { label: "Quiet Observation", run: () => this.adjust({ stress: -6, focus: +5, xp: +4 }, "You slowed down and reset your mindset.") }
        ]
      },
      park: {
        title: "City Park",
        text: "Breathing room among towers and traffic.",
        actions: [
          { label: "Walk + Podcast", run: () => this.adjust({ health: +5, focus: +7, stress: -7, xp: +6 }, "You learned while decompressing.") },
          { label: "Community Volunteering", run: () => this.adjust({ rep: +13, energy: -8, stress: -2, xp: +10 }, "Neighborhood trust increased.") },
          { label: "Freestyle Basketball", run: () => this.encounter("Street Challenger", 26, 52, { rep: +10, health: +4, xp: +8 }, { health: -10, stress: +4 }) }
        ]
      }
    };
  }
}

export function migrateSave(parsed) {
  const next = { ...parsed };
  if (!next.saveVersion || next.saveVersion < 2) {
    next.saveVersion = 2;
    if (!Array.isArray(next.quests)) next.quests = clone(BASE_STATE.quests);
    if (!next.stats) next.stats = { wins: 0, losses: 0 };
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

  const renderScene = () => {
    const loc = engine.locations[engine.state.location];
    ui.sceneTitle.textContent = loc.title;
    ui.sceneText.textContent = loc.text;
    ui.actions.innerHTML = "";
    for (const action of loc.actions) {
      const b = document.createElement("button");
      b.textContent = action.label;
      b.onclick = () => {
        action.run();
        renderAll();
      };
      ui.actions.appendChild(b);
    }

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
    ui.level.textContent = s.level;
    ui.health.textContent = s.health;
    ui.energy.textContent = s.energy;
    ui.focus.textContent = s.focus;
    ui.cash.textContent = s.cash;
    ui.rep.textContent = s.rep;
    ui.career.textContent = s.career;
    ui.stress.textContent = s.stress;
    ui.dayLabel.textContent = s.day;
    ui.cycleLabel.textContent = CYCLES[s.cycle];

    const need = xpToLevel(s.level);
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
    s.inventory.slice(-8).forEach(item => {
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
      s.achievements.slice(-6).reverse().forEach(a => {
        const li = document.createElement("li");
        li.className = "ach";
        li.innerHTML = `<strong>🏆 ${a.name}</strong><small>${a.description} (Day ${a.day})</small>`;
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
    engine.adjust({ energy: +18, health: +6, stress: -3 }, "Power nap helped you reset.");
    renderAll();
  };
  el("meditateBtn").onclick = () => {
    engine.adjust({ focus: +12, stress: -10, xp: +5 }, "Breathing exercise calmed your nervous system.");
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
    if (!confirm("Start a brand new run?")) return;
    engine.newRun();
    renderAll();
  };

  engine.log("Welcome to the expanded modern-world run.", "good");
  engine.log("Tip: Build rep + career to unlock stronger outcomes.", "warn");
  renderAll();
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", bindUI);
}
