import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { useAppStore } from '../store.tsx';
import { DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react';

const data = [
  { name: '10 AM', sales: 400, guests: 12 },
  { name: '12 PM', sales: 1200, guests: 45 },
  { name: '2 PM', sales: 800, guests: 30 },
  { name: '4 PM', sales: 600, guests: 20 },
  { name: '6 PM', sales: 1800, guests: 65 },
  { name: '8 PM', sales: 2400, guests: 85 },
  { name: '10 PM', sales: 1600, guests: 50 },
];

const StatCard = ({ title, value, subtext, icon: Icon, colorClass }: any) => (
  <div className="bg-white p-6 rounded-xl border-2 border-shift-gray shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-gray-500 text-sm font-medium font-mono uppercase">{title}</p>
        <h3 className="text-3xl font-bold mt-1">{value}</h3>
      </div>
      <div className={`p-3 rounded-lg ${colorClass} text-white`}>
        <Icon size={24} />
      </div>
    </div>
    <p className="text-sm text-gray-400">{subtext}</p>
  </div>
);

const Dashboard = () => {
  const { orders, reservations, ingredients } = useAppStore();
  
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
  const activeAlerts = ingredients.filter(i => i.stock < i.threshold).length;
  
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-shift-dark">Dashboard</h2>
          <p className="text-gray-500">Real-time operational overview.</p>
        </div>
        <div className="flex gap-2">
           <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-bold flex items-center gap-1">
             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div> System Online
           </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Revenue" 
          value={`$${totalRevenue.toFixed(2)}`} 
          subtext="+12% from yesterday" 
          icon={DollarSign} 
          colorClass="bg-shift-blue" 
        />
        <StatCard 
          title="Active Guests" 
          value={reservations.length * 2 + 14} 
          subtext="Currently seated" 
          icon={Users} 
          colorClass="bg-shift-magenta" 
        />
        <StatCard 
          title="Inventory Alerts" 
          value={activeAlerts} 
          subtext="Items below threshold" 
          icon={AlertTriangle} 
          colorClass="bg-shift-amber" 
        />
        <StatCard 
          title="Labor Cost" 
          value="22%" 
          subtext="of Gross Sales" 
          icon={TrendingUp} 
          colorClass="bg-shift-lime text-black" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold mb-6">Hourly Sales Performance</h3>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1a1a1a', color: '#fff', borderRadius: '8px', border: 'none' }} 
                itemStyle={{ color: '#BEF754' }}
              />
              <Bar dataKey="sales" fill="#0000FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-shift-dark p-6 rounded-xl shadow-sm text-white">
           <h3 className="text-lg font-bold mb-6">Guest Volume</h3>
           <ResponsiveContainer width="100%" height="85%">
            <LineChart data={data}>
              <XAxis dataKey="name" hide />
              <Tooltip contentStyle={{ backgroundColor: '#333', border: 'none' }} />
              <Line type="monotone" dataKey="guests" stroke="#BEF754" strokeWidth={3} dot={{r: 4}} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;