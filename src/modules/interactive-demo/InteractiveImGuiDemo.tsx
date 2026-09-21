"use client";

import { useMemo, useState } from "react";

type DemoTab = "rage" | "visuals" | "misc" | "world" | "settings";

type ToggleKey =
  | "enabled"
  | "silent"
  | "autoFire"
  | "penetrate"
  | "delayShot"
  | "duckPeek"
  | "speedFire"
  | "magicBullet"
  | "esp"
  | "teammates"
  | "behindWalls"
  | "dormant"
  | "bomb"
  | "weapons"
  | "grenades"
  | "nightMode"
  | "nickname"
  | "weaponName"
  | "hpLine"
  | "hit"
  | "box";

const tabItems: Array<{ id: DemoTab; label: string; icon: string }> = [
  { id: "rage", label: "Ragebot", icon: "◫" },
  { id: "visuals", label: "Visuals", icon: "◉" },
  { id: "misc", label: "Misc", icon: "⌘" },
  { id: "world", label: "World", icon: "◎" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function DemoSwitch({
  label,
  checked,
  onChange,
  tone,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  tone?: string;
}) {
  return (
    <button type="button" className="crz-imgui-row crz-imgui-row--switch" onClick={onChange}>
      <span>{label}</span>
      {tone && <i className="crz-imgui-dot" style={{ background: tone, boxShadow: "0 0 10px " + tone }} />}
      <b className={checked ? "is-on" : ""}><i /></b>
    </button>
  );
}

function DemoSlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <label className="crz-imgui-row crz-imgui-row--slider">
      <div><span>{label}</span><strong>{value}{suffix ?? ""}</strong></div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ "--slider-progress": percent + "%" } as React.CSSProperties}
      />
    </label>
  );
}

function DemoSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="crz-imgui-row crz-imgui-row--select">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DemoColor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="crz-imgui-row crz-imgui-row--color">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="crz-imgui-section">
      <header>{title}</header>
      <div>{children}</div>
    </section>
  );
}

export function InteractiveImGuiDemo({ title = "CRAZZY MENU" }: { title?: string }) {
  const [tab, setTab] = useState<DemoTab>("rage");
  const [search, setSearch] = useState("");
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    enabled: true,
    silent: true,
    autoFire: false,
    penetrate: false,
    delayShot: false,
    duckPeek: false,
    speedFire: true,
    magicBullet: true,
    esp: true,
    teammates: false,
    behindWalls: true,
    dormant: true,
    bomb: true,
    weapons: true,
    grenades: true,
    nightMode: false,
    nickname: true,
    weaponName: true,
    hpLine: true,
    hit: true,
    box: true,
  });
  const [fov, setFov] = useState(72);
  const [hitChance, setHitChance] = useState(68);
  const [maxMisses, setMaxMisses] = useState(12);
  const [speed, setSpeed] = useState(18);
  const [target, setTarget] = useState("Crosshair");
  const [hitbox, setHitbox] = useState("Head");
  const [history, setHistory] = useState("Latest");
  const [accent, setAccent] = useState("#6c63ff");
  const [enemyColor, setEnemyColor] = useState("#5cff6b");
  const [hpColor, setHpColor] = useState("#ff4b55");
  const [previewHp, setPreviewHp] = useState(85);
  const [toast, setToast] = useState<string | null>(null);

  const setToggle = (key: ToggleKey) => {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
    setToast("Configuração alterada");
    window.setTimeout(() => setToast(null), 1000);
  };

  const filter = search.trim().toLowerCase();
  const visible = (label: string) => !filter || label.toLowerCase().includes(filter);

  const previewStyle = useMemo(
    () => ({
      "--preview-enemy": enemyColor,
      "--preview-hp": hpColor,
      "--demo-accent": accent,
    } as React.CSSProperties),
    [accent, enemyColor, hpColor]
  );

  return (
    <div className="crz-imgui-demo" style={{ "--demo-accent": accent } as React.CSSProperties}>
      <div className="crz-imgui-toolbar">
        <span>DEMO INTERATIVA</span>
        <strong>Teste os controles em tempo real. Nenhuma opção atua fora desta página.</strong>
      </div>

      <div className="crz-imgui-stage">
        <div className="crz-imgui-window">
          <aside className="crz-imgui-sidebar">
            <div className="crz-imgui-brand">C R A Z Z Y</div>
            <nav>
              {tabItems.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={tab === item.id ? "is-active" : ""}
                  onClick={() => setTab(item.id)}
                >
                  <i>{item.icon}</i>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="crz-imgui-main">
            <header className="crz-imgui-topbar">
              <strong>{title}</strong>
              <label>
                <span>⌕</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
              </label>
              <button type="button" className="crz-imgui-accent-button" title="Accent color">
                <input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} />
              </button>
            </header>

            <div className="crz-imgui-content">
              {tab === "rage" && (
                <div className="crz-imgui-grid">
                  <div>
                    <Section title="General">
                      {visible("Enabled") && <DemoSwitch label="Enabled" checked={toggles.enabled} onChange={() => setToggle("enabled")} tone="#ff3d45" />}
                      {visible("Silent Aimbot") && <DemoSwitch label="Silent Aimbot" checked={toggles.silent} onChange={() => setToggle("silent")} tone="#31ff4b" />}
                      {visible("Automatic Fire") && <DemoSwitch label="Automatic Fire" checked={toggles.autoFire} onChange={() => setToggle("autoFire")} />}
                      {visible("Penetrate Walls") && <DemoSwitch label="Penetrate Walls" checked={toggles.penetrate} onChange={() => setToggle("penetrate")} />}
                      {visible("Field Of View") && <DemoSlider label="Field Of View" value={fov} min={0} max={180} suffix="°" onChange={setFov} />}
                    </Section>

                    <Section title="Selection">
                      {visible("Target") && <DemoSelect label="Target" value={target} options={["Crosshair", "Distance", "Health", "Priority"]} onChange={setTarget} />}
                      {visible("Hitboxes") && <DemoSelect label="Hitboxes" value={hitbox} options={["Head", "Chest", "Body", "Nearest"]} onChange={setHitbox} />}
                      {visible("Accent") && <DemoColor label="Accent Color" value={accent} onChange={setAccent} />}
                    </Section>

                    <Section title="Accuracy">
                      {visible("Hit Chance") && <DemoSlider label="Hit Chance" value={hitChance} min={0} max={100} suffix="%" onChange={setHitChance} />}
                      {visible("Max Misses") && <DemoSlider label="Max. Misses" value={maxMisses} min={0} max={50} onChange={setMaxMisses} />}
                    </Section>
                  </div>

                  <div>
                    <Section title="Min. Damage">
                      {visible("History") && <DemoSelect label="History" value={history} options={["Latest", "Selected", "Smart", "Disabled"]} onChange={setHistory} />}
                      {visible("Delay Shot") && <DemoSwitch label="Delay Shot" checked={toggles.delayShot} onChange={() => setToggle("delayShot")} />}
                      {visible("Duck Peek Assist") && <DemoSwitch label="Duck Peek Assist" checked={toggles.duckPeek} onChange={() => setToggle("duckPeek")} />}
                      {visible("Speed Up Fire Rate") && <DemoSwitch label="Speed Up Fire Rate" checked={toggles.speedFire} onChange={() => setToggle("speedFire")} />}
                      {visible("Magic Bullet") && <DemoSwitch label="Magic Bullet" checked={toggles.magicBullet} onChange={() => setToggle("magicBullet")} />}
                      {visible("Speed") && <DemoSlider label="Speed" value={speed} min={0} max={30} onChange={setSpeed} />}
                    </Section>

                    <Section title="Exploit Preview">
                      <DemoSwitch label="Simulation Enabled" checked={toggles.enabled} onChange={() => setToggle("enabled")} />
                      <DemoSelect label="Pitch" value="Selected" options={["Selected", "Down", "Up", "Neutral"]} onChange={() => {}} />
                    </Section>
                  </div>
                </div>
              )}

              {tab === "visuals" && (
                <div className="crz-imgui-grid">
                  <div>
                    <Section title="Players">
                      <DemoSwitch label="ESP Preview" checked={toggles.esp} onChange={() => setToggle("esp")} tone={enemyColor} />
                      <DemoSwitch label="Teammates" checked={toggles.teammates} onChange={() => setToggle("teammates")} />
                      <DemoSwitch label="Behind Walls" checked={toggles.behindWalls} onChange={() => setToggle("behindWalls")} />
                      <DemoSwitch label="Dormant" checked={toggles.dormant} onChange={() => setToggle("dormant")} />
                      <DemoColor label="Enemy Color" value={enemyColor} onChange={setEnemyColor} />
                    </Section>
                    <Section title="Player Info">
                      <DemoSwitch label="Nickname" checked={toggles.nickname} onChange={() => setToggle("nickname")} />
                      <DemoSwitch label="Weapon" checked={toggles.weaponName} onChange={() => setToggle("weaponName")} />
                      <DemoSwitch label="HP Line" checked={toggles.hpLine} onChange={() => setToggle("hpLine")} tone={hpColor} />
                      <DemoSlider label="Preview HP" value={previewHp} min={1} max={100} suffix="%" onChange={setPreviewHp} />
                      <DemoColor label="HP Color" value={hpColor} onChange={setHpColor} />
                    </Section>
                  </div>

                  <div>
                    <Section title="World">
                      <DemoSwitch label="Bomb" checked={toggles.bomb} onChange={() => setToggle("bomb")} />
                      <DemoSwitch label="Weapons" checked={toggles.weapons} onChange={() => setToggle("weapons")} />
                      <DemoSwitch label="Grenades" checked={toggles.grenades} onChange={() => setToggle("grenades")} />
                    </Section>
                    <Section title="Common">
                      <DemoSwitch label="Night Mode" checked={toggles.nightMode} onChange={() => setToggle("nightMode")} />
                      <DemoSwitch label="Hit Marker" checked={toggles.hit} onChange={() => setToggle("hit")} />
                      <DemoSwitch label="Box" checked={toggles.box} onChange={() => setToggle("box")} />
                    </Section>
                  </div>
                </div>
              )}

              {tab === "misc" && (
                <div className="crz-imgui-grid">
                  <div>
                    <Section title="Movement">
                      <DemoSwitch label="Bunny Hop" checked={toggles.duckPeek} onChange={() => setToggle("duckPeek")} />
                      <DemoSlider label="Movement Speed" value={speed} min={0} max={30} onChange={setSpeed} />
                    </Section>
                  </div>
                  <div>
                    <Section title="Interface">
                      <DemoColor label="Accent" value={accent} onChange={setAccent} />
                      <DemoSwitch label="Notifications" checked={toggles.enabled} onChange={() => setToggle("enabled")} />
                    </Section>
                  </div>
                </div>
              )}

              {tab === "world" && (
                <div className="crz-imgui-grid">
                  <div>
                    <Section title="Objects">
                      <DemoSwitch label="Weapons" checked={toggles.weapons} onChange={() => setToggle("weapons")} />
                      <DemoSwitch label="Grenades" checked={toggles.grenades} onChange={() => setToggle("grenades")} />
                      <DemoSwitch label="Bomb" checked={toggles.bomb} onChange={() => setToggle("bomb")} />
                    </Section>
                  </div>
                  <div>
                    <Section title="Environment">
                      <DemoSwitch label="Night Mode" checked={toggles.nightMode} onChange={() => setToggle("nightMode")} />
                      <DemoSlider label="World Brightness" value={100 - (toggles.nightMode ? 65 : 15)} min={0} max={100} suffix="%" onChange={() => {}} />
                    </Section>
                  </div>
                </div>
              )}

              {tab === "settings" && (
                <div className="crz-imgui-grid">
                  <div>
                    <Section title="Theme">
                      <DemoColor label="Accent Color" value={accent} onChange={setAccent} />
                      <DemoColor label="Preview Color" value={enemyColor} onChange={setEnemyColor} />
                    </Section>
                  </div>
                  <div>
                    <Section title="Profile">
                      <DemoSelect label="Config" value="CRAZZY Default" options={["CRAZZY Default", "Legit", "Aggressive", "Custom"]} onChange={() => {}} />
                      <DemoSwitch label="Cloud Save" checked={toggles.enabled} onChange={() => setToggle("enabled")} />
                    </Section>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="crz-imgui-preview" style={previewStyle}>
          <header><span>PREVIEW</span><strong>95%</strong></header>
          <div className={toggles.nightMode ? "is-night" : ""}>
            {toggles.nickname && <span className="crz-imgui-preview__name">CRAZZY USER</span>}
            {toggles.box && <i className="crz-imgui-preview__box" />}
            <div className="crz-imgui-preview__figure">
              <i className="head" /><i className="torso" /><i className="arm arm-l" /><i className="arm arm-r" /><i className="leg leg-l" /><i className="leg leg-r" />
            </div>
            {toggles.hpLine && (
              <div className="crz-imgui-preview__hp">
                <i style={{ height: previewHp + "%" }} />
              </div>
            )}
            {toggles.weaponName && <span className="crz-imgui-preview__weapon">Weapon</span>}
            {toggles.hit && <span className="crz-imgui-preview__hit">HIT</span>}
          </div>
          <footer><span>Zoomed</span><span>{toggles.esp ? "ESP ON" : "ESP OFF"}</span></footer>
        </aside>

        {toast && <div className="crz-imgui-toast">{toast}</div>}
      </div>
    </div>
  );
}
