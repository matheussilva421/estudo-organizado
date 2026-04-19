const fs = require('fs');
const path = require('path');

const files = [
  'src/js/views/home-view.js',
  'src/js/views/editais-view.js',
  'src/js/views/dashboard-view.js',
  'src/js/views.js'
];

const patterns = {
  'margin-bottom:4px;?': 'mb-1',
  'margin-bottom:6px;?': 'mb-2', // roughly
  'margin-bottom:8px;?': 'mb-2',
  'margin-bottom:10px;?': 'mb-3', // roughly
  'margin-bottom:12px;?': 'mb-3',
  'margin-bottom:16px;?': 'mb-4',
  'margin-bottom:20px;?': 'mb-5',
  'margin-bottom:24px;?': 'mb-6',
  'margin-top:4px;?': 'mt-1',
  'margin-top:8px;?': 'mt-2',
  'margin-top:12px;?': 'mt-3',
  'margin-top:16px;?': 'mt-4',
  'gap:4px;?': 'gap-xs',
  'gap:6px;?': 'gap-sm',
  'gap:8px;?': 'gap-sm',
  'gap:12px;?': 'gap-md',
  'gap:16px;?': 'gap-lg',
  'padding-bottom:8px;?': 'pb-2',
  'padding-right:8px;?': 'pr-2',
  'height:100%;?': 'h-full',
  'width:100%;?': 'w-full',
  'line-height:1;?': 'leading-none',
  'align-items:center;?': 'items-center',
  'justify-content:space-between;?': 'justify-between',
  'justify-content:flex-end;?': 'justify-end',
  'position:absolute;?': 'absolute',
  'position:relative;?': 'relative',
  'border-radius:4px;?': 'rounded-sm',
  'border-radius:6px;?': 'rounded-md',
  'border-radius:8px;?': 'rounded-lg',
  'border-radius:12px;?': 'rounded-xl',
};

files.forEach(file => {
  const filePath = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Find all style attributes
  content = content.replace(/class="([^"]*)"\s*style="([^"]*)"/g, (match, classes, styleContent) => {
    let newClasses = new Set(classes.split(' '));
    let newStyles = [];

    const styleRules = styleContent.split(';').map(s => s.trim()).filter(Boolean);
    
    styleRules.forEach(rule => {
      let matched = false;
      for (const [pattern, className] of Object.entries(patterns)) {
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(rule) || regex.test(rule + ';')) {
          newClasses.add(className);
          matched = true;
          break;
        }
      }
      if (!matched) {
        newStyles.push(rule);
      }
    });

    const finalClasses = Array.from(newClasses).join(' ').trim();
    if (newStyles.length > 0) {
      return `class="${finalClasses}" style="${newStyles.join('; ')};"`;
    } else {
      return `class="${finalClasses}"`;
    }
  });
  
  // also handle the case where style comes before class
  content = content.replace(/style="([^"]*)"\s*class="([^"]*)"/g, (match, styleContent, classes) => {
    let newClasses = new Set(classes.split(' '));
    let newStyles = [];

    const styleRules = styleContent.split(';').map(s => s.trim()).filter(Boolean);
    
    styleRules.forEach(rule => {
      let matched = false;
      for (const [pattern, className] of Object.entries(patterns)) {
        const regex = new RegExp(`^${pattern}$`);
        if (regex.test(rule) || regex.test(rule + ';')) {
          newClasses.add(className);
          matched = true;
          break;
        }
      }
      if (!matched) {
        newStyles.push(rule);
      }
    });

    const finalClasses = Array.from(newClasses).join(' ').trim();
    if (newStyles.length > 0) {
      return `class="${finalClasses}" style="${newStyles.join('; ')};"`;
    } else {
      return `class="${finalClasses}"`;
    }
  });

  fs.writeFileSync(filePath, content);
  console.log(`Processed ${file}`);
});
