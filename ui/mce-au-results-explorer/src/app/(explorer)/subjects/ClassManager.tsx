import { useState, useEffect } from "react";

export interface StudentClass {
  id: string;
  name: string;
  prefix: string;
  intervals: string;
}

export function parseClassIntervals(cls: StudentClass): string[] {
  const regnos = new Set<string>();
  const parts = cls.intervals.split(',');
  const padLength = Math.max(0, 12 - cls.prefix.length);

  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('-')) {
      const [start, end] = p.split('-');
      const s = parseInt(start, 10);
      const e = parseInt(end, 10);
      if (!isNaN(s) && !isNaN(e) && s <= e) {
        for (let i = s; i <= e; i++) {
          regnos.add(cls.prefix + String(i).padStart(padLength, '0'));
        }
      }
    } else {
      const v = parseInt(p, 10);
      if (!isNaN(v)) {
        regnos.add(cls.prefix + String(v).padStart(padLength, '0'));
      }
    }
  }
  return Array.from(regnos);
}

export function ClassManager({
  onSelectClass,
  defaultPrefix = "",
}: {
  onSelectClass: (regnos: string[] | null) => void;
  defaultPrefix?: string;
}) {
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [activeClassId, setActiveClassId] = useState<string | "">("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("au_results_explorer_classes");
    if (stored) {
      try {
        setClasses(JSON.parse(stored));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const saveClasses = (newClasses: StudentClass[]) => {
    setClasses(newClasses);
    localStorage.setItem("au_results_explorer_classes", JSON.stringify(newClasses));
  };

  const applyClass = (id: string) => {
    setActiveClassId(id);
    if (!id) {
      onSelectClass(null);
      return;
    }
    const cls = classes.find(c => c.id === id);
    if (!cls) {
      onSelectClass(null);
      return;
    }
    const regnos = parseClassIntervals(cls);
    onSelectClass(regnos.length > 0 ? regnos : null);
  };

  const handleAddNew = () => {
    const fresh = { id: Date.now().toString(), name: "New Class", prefix: defaultPrefix, intervals: "1-10, 12, 14-18" };
    saveClasses([...classes, fresh]);
    setIsEditing(true);
  };

  return (
    <div className="mb-4 p-3 border border-[#dbe3ff] rounded-lg bg-[#f0f4ff] shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="text-[0.8rem] font-semibold text-[var(--muted)]">Filter by Class:</label>
          <select
            className="text-sm border border-[#dbe3ff] rounded px-2 py-1 outline-none text-[#1d2d7a] font-medium"
            value={activeClassId}
            onChange={(e) => applyClass(e.target.value)}
          >
            <option value="">All Students (No class filter)</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs font-bold text-[#1d2d7a] hover:text-indigo-800 transition uppercase tracking-widest"
        >
          {isEditing ? "Close Editor" : "Edit Classes"}
        </button>
      </div>

      {isEditing && (
        <div className="bg-white border border-[#dbe3ff] rounded-[8px] p-3 flex flex-col gap-3">
          <p className="m-0 text-xs text-[var(--muted)] font-bold uppercase tracking-[0.04em]">Class Editor</p>
          {classes.length === 0 ? (
            <p className="m-0 text-sm text-[var(--muted)]">No classes saved. Click 'Add Class' to create one.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {classes.map((cls, idx) => (
                <div key={cls.id} className="flex flex-col xl:flex-row gap-2 items-start xl:items-center bg-[#f8faff] p-2 border border-[#dbe3ff] rounded-[6px]">
                  <input 
                    className="text-sm border border-[#dbe3ff] rounded px-2 py-1 flex-1 min-w-[120px]"
                    placeholder="Class Name (e.g. E37A)"
                    value={cls.name}
                    onChange={(e) => {
                      const c = [...classes];
                      c[idx].name = e.target.value;
                      saveClasses(c);
                    }}
                  />
                  <input 
                    className="text-sm border border-[#dbe3ff] rounded px-2 py-1 flex-1 xl:max-w-[140px]"
                    placeholder="Prefix: 812821205"
                    value={cls.prefix}
                    title="Registration number prefix"
                    onChange={(e) => {
                      const c = [...classes];
                      c[idx].prefix = e.target.value;
                      saveClasses(c);
                    }}
                  />
                  <input 
                    className="text-sm border border-[#dbe3ff] rounded px-2 py-1 flex-[2]"
                    placeholder="Intervals (1-10, 12, 14-18)"
                    value={cls.intervals}
                    title="Comma separated intervals"
                    onChange={(e) => {
                      const c = [...classes];
                      c[idx].intervals = e.target.value;
                      saveClasses(c);
                    }}
                  />
                  <button
                    onClick={() => {
                      const c = classes.filter(x => x.id !== cls.id);
                      saveClasses(c);
                      if (activeClassId === cls.id) applyClass("");
                    }}
                    className="text-red-500 hover:text-red-700 text-xs uppercase font-bold tracking-wider px-2 shrink-0 py-1"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
          <div>
            <button onClick={handleAddNew} className="text-xs bg-[#eef2ff] text-[#1d2d7a] border border-[#dbe3ff] hover:bg-[#dfe6ff] px-3 py-1.5 rounded font-bold uppercase tracking-wider transition">
              + Add Class
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
