import CodeConverter from './CodeConverter';
import ToolFooter from '@/components/ToolFooter'; 
import { getToolContent } from '@/lib/toolContent';

export const metadata = {
  title: 'Code Converter',
  description: 'Translate code between Python, JavaScript, Java, C++, and 15+ other languages.',
};

export default function Page() {
 return <CodeConverter />
}