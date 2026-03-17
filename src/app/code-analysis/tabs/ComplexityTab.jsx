"use client";

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export function ComplexityTab({ complexity }) {
 
 const chartData = useMemo(() => {
  if (!complexity?.time) return [];
  
  const timeStr = complexity.time.toLowerCase().replace(/[\s\(\)]/g, '').replace(/^o/, '');
  
  const data = [];
  for (let n = 1; n <= 10; n++) {
   let operations = n;
   
   if (timeStr === '1') operations = 1;
   else if (timeStr === 'logn') operations = Math.log2(n + 1);
   
   else if (timeStr === 'n') operations = n;
   
   else if (timeStr === 'nlogn') operations = n * Math.log2(n + 1);
   
   else if (timeStr.includes('n^2') || timeStr.includes('n²')) operations = n * n;
   
   else if (timeStr.includes('n^3') || timeStr.includes('n³')) operations = n * n * n;
   
   else if (timeStr.includes('2^n')) operations = Math.pow(2, n);
   
   else if (timeStr.includes('n!')) {
    let fact = 1;
    
    for (let i = 2; i <= n; i++) fact *= i;
    operations = fact;
   }
   
   data.push({ inputElements: `n=${n}`, operations: Number(operations.toFixed(2)) });
  }
  return data;
 }, [complexity]);
 
 const getMetricClass = (value, type) => {
  if (value === undefined || value === null) return 'score-neutral';
  if (type === 'low-is-better') {
   if (value <= 10) return 'score-good';
   if (value <= 20) return 'score-warn';
   return 'score-bad';
  } else {
   if (value >= 80) return 'score-good';
   if (value >= 60) return 'score-warn';
   return 'score-bad';
  }
 };
 
 return (
  <div className="complexity-breakdown">
   <div>
    <div className="complexity-grid">
     <div className="complexity-card">
      <div className="complexity-icon"><i className="fa-solid fa-clock"></i></div>
      <div className="complexity-info"><h4>Time</h4><p>{complexity.time}</p></div>
     </div>
     <div className="complexity-card">
      <div className="complexity-icon"><i className="fa-solid fa-memory"></i></div>
      <div className="complexity-info"><h4>Space</h4><p>{complexity.space}</p></div>
     </div>
    </div>
        
    <ul className="complexity-explanation-list">
     {complexity.explanation.map((item, i) => <li key={i}>{item}</li>)}
    </ul>

    {complexity?.bottleneck && (
     <div className="insight-box">
      <i className="fa-solid fa-traffic-cone"></i>
       <div className="insight-content">
        <h4>Primary Bottleneck</h4>
        <p>{complexity.bottleneck}</p>
       </div>
      </div>
     )}

     {complexity?.tradeoffs && (
      <div className="insight-box">
       <i className="fa-solid fa-scale-balanced"></i>
        <div className="insight-content">
         <h4>Space-Time Tradeoffs</h4>
         <p>{complexity.tradeoffs}</p>
        </div>
       </div>
      )}
     </div>
      
     <div className="complexity-chart-container">
      <ResponsiveContainer width="100%" height="100%">
       
       <LineChart data={chartData} margin={{ top: 30, right: 30, left: 0, bottom: 20 }}>
        
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.3} />
        
        <XAxis 
         dataKey="inputElements" 
         axisLine={true} 
         tickLine={false} 
         tick={{fill: 'var(--text-secondary)', fontSize: 12}} 
         dy={15} 
         label={{ value: 'Input Size (Elements)', position: 'insideBottom', offset: -15, fill: 'var(--text-secondary)', fontSize: 13 }}
        />
        
        <YAxis 
         allowDecimals={false} 
         axisLine={true} 
         tickLine={false} 
         domain={[0, dataMax => Math.max(dataMax, 4)]} 
         tick={{fill: 'var(--text-secondary)', fontSize: 12}} dx={-10} label={{ value: 'Operations (Time)', angle: -90, position: 'insideLeft', fill: 'var(--text-secondary)', fontSize: 13 }}
        />
        
        <Tooltip 
         cursor={{ stroke: 'var(--accent)', strokeWidth: 1, strokeDasharray: '4 4' }} 
         contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-subtle)' }} 
         formatter={(value) => [`${value} Ops`, 'Complexity']} 
         labelStyle={{ color: 'var(--accent)', fontWeight: 'bold', marginBottom: '5px' }}
        />
        
        <Line 
         type="monotone" 
         dataKey="operations" 
         name="Growth Rate" 
         stroke="var(--accent)" 
         strokeWidth={4} 
         dot={{ r: 4, fill: 'var(--bg-primary)', stroke: 'var(--accent)', strokeWidth: 2 }} 
         activeDot={{ r: 8, fill: 'var(--accent)', stroke: 'var(--bg-primary)', strokeWidth: 3 }} 
         animationDuration={1500} animationEasing="ease-out" 
        />
        
        </LineChart>
       </ResponsiveContainer>
      </div>
      
      {complexity?.metrics && (
       <div className="metrics-container">
        <div className="metric-card">
         <div className="metric-header">
          <span className="metric-title">Cyclomatic</span>
          <span className={`metric-score ${getMetricClass(complexity.metrics.cyclomatic, 'low-is-better')}`}>{complexity.metrics.cyclomatic}</span>
         </div>
         <p className="metric-desc">Counts independent paths. Lower is easier to test.</p>
        </div>
        <div className="metric-card">
         <div className="metric-header">
          <span className="metric-title">Cognitive</span>
          <span className={`metric-score ${getMetricClass(complexity.metrics.cognitive, 'low-is-better')}`}>{complexity.metrics.cognitive}</span>
         </div>
      <p className="metric-desc">How difficult the control flow is for humans.</p>
     </div>
     <div className="metric-card">
      <div className="metric-header">
       <span className="metric-title">Maintainability</span>
       <span className={`metric-score ${getMetricClass(complexity.metrics.maintainability, 'high-is-better')}`}>{complexity.metrics.maintainability}</span>
      </div>
      <p className="metric-desc">Overall index (0-100). Higher is easier to modify.</p>
     </div>
    </div>
   )}
  </div>
 );
}