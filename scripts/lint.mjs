import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
const failures=[];
function visit(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory()){visit(file);continue}if(!/\.(tsx?|css)$/.test(file))continue;const source=fs.readFileSync(file,'utf8');if(file.endsWith('.css')){if(source.includes('}\\n')||source.includes(';\\n'))failures.push(file+': literal escaped newline in CSS');continue}const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);for(const d of ast.parseDiagnostics)failures.push(file+': '+ts.flattenDiagnosticMessageText(d.messageText,' '));function check(node){if(ts.isCallExpression(node)){const name=node.expression.getText(ast);if(/^(?:(?:window|globalThis)\.)?(?:prompt|confirm|alert)$/.test(name))failures.push(file+': native browser dialog '+name)}if(node.kind===ts.SyntaxKind.DebuggerStatement)failures.push(file+': debugger statement');ts.forEachChild(node,check)}check(ast)}}
visit('src');visit('supabase/functions');
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('[PASS] Project lint: source syntax, native dialogs, debugger statements and CSS escapes');
