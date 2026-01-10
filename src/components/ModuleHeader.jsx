import { useState } from 'react';
import { saveHistory } from '../services/firebase';

export default function ModuleHeader({ title, description, resultData }) {
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);
 
 const handleSave = async () => {
  // Only proced if there is data and aren't already saving/saved
  if (!resultData || saving || saved) return;
  
  setSaving(true);
  try {
   await saveHistory(
    resultData.type,
    resultData.input,
    resultData.output,
    resultData.sourceLang || null,
    resultData.targetLang || null
   );
   setSaved(true);
   // Allows saving again after 3 sec.
   setTimeout(() => setSaved(false), 3000);
  } catch (error) {
   console.error("Manual save failed:", error);
   alert("Error saving to history.");
  } finally {
   setSaving(false);
  }
 };
 
 return (
  <header className="module-header">
   <div className="header-content">
    <h1>{title}</h1>
    <p>{description}</p>
   </div>
   
   {resultData && (
    <button className={`save-btn ${saved ? 'success' : ''}`} onClick={handleSave} disabled={saving || saved}>
     {saving ? (
      <><i className="fas fa-spinner fa-spin"></i> Svaing...</>
     ) : saved ? (
      <><i className="fas fa-check"></i> Saved</>
     ) : (
      <><i className="fas fa-save"></i> Save Result</>
     )}
    </button>
   )}
  </header>
 );
}