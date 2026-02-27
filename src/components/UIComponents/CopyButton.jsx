import { useState } from 'react';

export default function CopyButton({ codeToCopy }) {
 const [copyFeedback, setCopyFeedback] = useState('Copy');
 
 const handleCopy = () => {
  if (codeToCopy) {
   navigator.clipboard.writeText(codeToCopy);
   setCopyFeedback('Copied!');
   setTimeout(() => setCopyFeedback('Copy'), 2000);
  }
 };
 
 return (
   <button 
     className="primary-button copy-btn copy-btn-absolute" 
     onClick={handleCopy} 
     title="Copy To Clipboard!">
    <i className={copyFeedback === 'Copied!' ? "fa-solid fa-check" : "fa-regular fa-copy"}></i>
    
    {copyFeedback}
    
   </button>
 );
}