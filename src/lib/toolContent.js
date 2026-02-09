export const toolsContent = [
 {
  slug: 'code-analysis',
  title: 'AI Code Analysis & Security Auditor',
  heading: 'Optimize Your Code with AI-Powered Static Analysis',
  description: `
      Our intelligent Code Auditor tool helps developers instantly analyze their source code for bugs, 
      security vulnerabilities, and performance bottlenecks. By leveraging advanced AI models, 
      this tool goes beyond simple syntax checking to understand the logic and complexity (Big O) 
      of your algorithms.
    `,
  features: [
  {
   title: 'Security Vulnerability Detection',
   text: 'Identify potential security risks such as injection attacks, data leaks, and unsafe dependencies before they reach production.'
  },
  {
   title: 'Time Complexity (Big O) Analysis',
   text: 'Get instant feedback on the algorithmic efficiency of your functions to ensure your application scales effectively.'
  },
  {
   title: 'Automated Code Review',
   text: 'Receive an automated peer review with actionable suggestions to improve readability, maintainability, and best practices.'
  }],
  faq: [
  {
   question: 'How does the AI code analysis work?',
   answer: 'We use large language models trained on millions of lines of code to interpret your syntax, logic, and structure, comparing it against known patterns of high-quality software.'
  },
  {
   question: 'Is my code stored effectively?',
   answer: 'No. Your code is processed in real-time for analysis and is not permanently stored or used to train any models.'
  }]
 },
 
];

export const getToolContent = (slug) => {
 return toolsContent.find(tool => tool.slug === slug) || null;
};