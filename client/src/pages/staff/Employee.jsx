import { useEffect, useState } from 'react';
import Shell from './Shell.jsx';
import { api } from '../../api.js';
import { useAuth } from '../../auth.jsx';
import { AppointmentsPanel, ChatsPanel, BlockPanel } from './panels.jsx';
import { WorkloadPanel } from './workload.jsx';
import { CapacityPanel, WalkInPanel } from './walkins.jsx';

const MINE = [['work', 'My workload'], ['appts', 'My appointments'], ['block', 'Block schedule'], ['chats', 'Live chats']];
const DESK = [['d_appts', 'All appointments'], ['d_work', 'All workload'], ['d_capacity', 'Capacity'], ['d_walkin', 'Walk-ins']];

export default function Employee() {
  const { user } = useAuth();
  const [desk, setDesk] = useState(!!user?.front_desk);
  const [people, setPeople] = useState([]);
  const tabs = desk ? [...DESK, ...MINE] : [['work', 'My workload'], ['appts', 'My appointments'], ['walkin', 'Walk-ins'], ['block', 'Block schedule'], ['chats', 'Live chats']];
  const [tab, setTab] = useState(desk ? 'd_appts' : 'work');
  const current = tabs.some(([k]) => k === tab) ? tab : 'work';

  // The admin can switch front desk on or off at any time, so re-check the role now and then.
  useEffect(() => {
    const load = () => api('/auth/me').then((d) => setDesk(!!d.user.front_desk)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (desk) api('/employees/options').then(setPeople).catch(() => {}); }, [desk]);

  return (
    <Shell title={desk ? 'Front desk dashboard' : 'Employee dashboard'} tabs={tabs} tab={current} setTab={setTab}>
      {current === 'd_appts' && <AppointmentsPanel admin employees={people} />}
      {current === 'd_work' && <WorkloadPanel admin />}
      {current === 'd_capacity' && <CapacityPanel />}
      {current === 'd_walkin' && <WalkInPanel admin employees={people} />}
      {current === 'work' && <WorkloadPanel />}
      {current === 'appts' && <AppointmentsPanel />}
      {current === 'walkin' && <WalkInPanel />}
      {current === 'block' && <BlockPanel />}
      {current === 'chats' && <ChatsPanel />}
    </Shell>
  );
}
