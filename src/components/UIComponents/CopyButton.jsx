import { useState } from 'react';

export default function CopyButton({
 codeToCopy,
 label = "Copy",
 className = "primary-button copy-btn copy-btn-absolute",
 iconOnly = false
}) {
 const [copyFeedback, setCopyFeedback] = useState(label);
 
 const handleCopy = () => {
  if (codeToCopy) {
   navigator.clipboard.writeText(codeToCopy);
   setCopyFeedback('Copied!');
   setTimeout(() => setCopyFeedback(label), 2000);
  }
 };
 
 return (
  <button 
    className={className} 
     onClick={handleCopy} 
     title="Copy To Clipboard!"
   >
    <i className={copyFeedback === 'Copied!' ? "fa-solid fa-check" : "fa-regular fa-copy"}></i>
    {!iconOnly && ` ${copyFeedback}`}
  </button>
 );
}