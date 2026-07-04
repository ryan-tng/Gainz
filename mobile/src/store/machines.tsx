import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { SEED_MACHINES } from '@/lib/seed';
import { storage, uid } from '@/lib/storage';
import type { Machine } from '@/lib/types';

export type MachineInput = Omit<Machine, 'id' | 'isCustom'>;

interface MachinesContextValue {
  loaded: boolean;
  machines: Machine[];
  addMachine: (input: MachineInput) => Machine;
  updateMachine: (id: string, input: MachineInput) => void;
  deleteMachine: (id: string) => void;
  getMachine: (id: string) => Machine | undefined;
}

const MachinesContext = createContext<MachinesContextValue | null>(null);

export function MachinesProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);

  useEffect(() => {
    (async () => {
      let m = await storage.loadMachines();
      if (m.length === 0) {
        m = SEED_MACHINES.map((x) => ({ ...x, id: uid('mc') }));
        await storage.saveMachines(m);
      }
      setMachines(m);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) void storage.saveMachines(machines);
  }, [machines, loaded]);

  const value = useMemo<MachinesContextValue>(
    () => ({
      loaded,
      machines,
      addMachine: (input) => {
        const machine: Machine = { ...input, id: uid('mc'), isCustom: true };
        setMachines((cur) => [...cur, machine].sort((a, b) => a.name.localeCompare(b.name)));
        return machine;
      },
      updateMachine: (id, input) =>
        setMachines((cur) =>
          cur
            .map((m) => (m.id === id ? { ...m, ...input } : m))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      deleteMachine: (id) => setMachines((cur) => cur.filter((m) => m.id !== id)),
      getMachine: (id) => machines.find((m) => m.id === id),
    }),
    [loaded, machines],
  );

  return <MachinesContext.Provider value={value}>{children}</MachinesContext.Provider>;
}

export function useMachines(): MachinesContextValue {
  const ctx = useContext(MachinesContext);
  if (!ctx) throw new Error('useMachines must be used within a MachinesProvider');
  return ctx;
}
