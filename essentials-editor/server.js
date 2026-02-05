const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8220;
const YAML_PATH = path.join(__dirname, '..', 'src', 'main', 'resources', 'essentials.yml');

// Enhanced YAML parser
function parseYaml(content) {
    const lines = content.split('\n');
    const result = { 'menu-title': '', sections: {} };
    
    let currentSection = null;
    let currentItem = null;
    let inItems = false;
    let inPotion = false;
    let inFirework = false;
    let inEnchantments = false;
    let inLore = false;
    let inFlags = false;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (trimmed.startsWith('#') || trimmed === '') continue;
        
        // Menu title
        if (trimmed.startsWith('menu-title:')) {
            result['menu-title'] = trimmed.split('menu-title:')[1].trim().replace(/^["']|["']$/g, '');
            continue;
        }
        
        // Section start
        const sectionMatch = line.match(/^  ([a-z_]+):$/);
        if (sectionMatch) {
            currentSection = sectionMatch[1];
            result.sections[currentSection] = {
                icon: '',
                name: '',
                slot: 0,
                'menu-title': '',
                items: []
            };
            inItems = false;
            continue;
        }
        
        if (currentSection) {
            // Section properties (4 space indent)
            if (line.startsWith('    ') && !line.startsWith('      ')) {
                const propLine = trimmed;
                
                if (propLine.startsWith('icon:')) {
                    result.sections[currentSection].icon = propLine.split('icon:')[1].trim();
                } else if (propLine.startsWith('name:')) {
                    result.sections[currentSection].name = propLine.split('name:')[1].trim().replace(/^["']|["']$/g, '');
                } else if (propLine.startsWith('slot:')) {
                    result.sections[currentSection].slot = parseInt(propLine.split('slot:')[1].trim());
                } else if (propLine.startsWith('menu-title:')) {
                    result.sections[currentSection]['menu-title'] = propLine.split('menu-title:')[1].trim().replace(/^["']|["']$/g, '');
                } else if (propLine === 'items:') {
                    inItems = true;
                }
                continue;
            }
            
            // Items (6 space indent with -)
            if (inItems && line.startsWith('      - ')) {
                const itemLine = line.substring(8);
                currentItem = { material: '' };
                
                if (itemLine.startsWith('material:')) {
                    currentItem.material = itemLine.split('material:')[1].trim();
                }
                result.sections[currentSection].items.push(currentItem);
                inPotion = false;
                inFirework = false;
                inEnchantments = false;
                inLore = false;
                inFlags = false;
                continue;
            }
            
            // Item properties (8 space indent)
            if (inItems && currentItem && line.startsWith('        ') && !line.startsWith('          ')) {
                const propLine = trimmed;
                
                if (propLine.startsWith('material:')) {
                    currentItem.material = propLine.split('material:')[1].trim();
                } else if (propLine.startsWith('amount:')) {
                    currentItem.amount = parseInt(propLine.split('amount:')[1].trim());
                } else if (propLine.startsWith('name:')) {
                    currentItem.name = propLine.split('name:')[1].trim().replace(/^["']|["']$/g, '');
                } else if (propLine.startsWith('unbreakable:')) {
                    currentItem.unbreakable = propLine.split('unbreakable:')[1].trim() === 'true';
                } else if (propLine.startsWith('glow:')) {
                    currentItem.glow = propLine.split('glow:')[1].trim() === 'true';
                } else if (propLine.startsWith('custom-model-data:')) {
                    currentItem['custom-model-data'] = parseInt(propLine.split('custom-model-data:')[1].trim());
                } else if (propLine === 'potion:') {
                    currentItem.potion = { type: '' };
                    inPotion = true;
                    inFirework = false;
                    inEnchantments = false;
                    inLore = false;
                    inFlags = false;
                } else if (propLine === 'firework:') {
                    currentItem.firework = { power: 1 };
                    inFirework = true;
                    inPotion = false;
                    inEnchantments = false;
                    inLore = false;
                    inFlags = false;
                } else if (propLine === 'enchantments:') {
                    currentItem.enchantments = [];
                    inEnchantments = true;
                    inPotion = false;
                    inFirework = false;
                    inLore = false;
                    inFlags = false;
                } else if (propLine === 'lore:') {
                    currentItem.lore = [];
                    inLore = true;
                    inPotion = false;
                    inFirework = false;
                    inEnchantments = false;
                    inFlags = false;
                } else if (propLine === 'flags:') {
                    currentItem.flags = [];
                    inFlags = true;
                    inPotion = false;
                    inFirework = false;
                    inEnchantments = false;
                    inLore = false;
                }
                continue;
            }
            
            // Sub-properties (10 space indent)
            if (line.startsWith('          ')) {
                const propLine = trimmed;
                
                if (inPotion && currentItem.potion && propLine.startsWith('type:')) {
                    currentItem.potion.type = propLine.split('type:')[1].trim();
                } else if (inFirework && currentItem.firework && propLine.startsWith('power:')) {
                    currentItem.firework.power = parseInt(propLine.split('power:')[1].trim());
                } else if (inEnchantments && currentItem.enchantments && propLine.startsWith('- ')) {
                    const enchantStr = propLine.substring(2);
                    const colonIndex = enchantStr.lastIndexOf(':');
                    if (colonIndex > 0) {
                        const type = enchantStr.substring(0, colonIndex).trim();
                        const level = parseInt(enchantStr.substring(colonIndex + 1).trim()) || 1;
                        currentItem.enchantments.push({ type, level });
                    }
                } else if (inLore && currentItem.lore && propLine.startsWith('- ')) {
                    currentItem.lore.push(propLine.substring(2).replace(/^["']|["']$/g, ''));
                } else if (inFlags && currentItem.flags && propLine.startsWith('- ')) {
                    currentItem.flags.push(propLine.substring(2));
                }
            }
        }
    }
    
    return result;
}

function toYaml(data) {
    let yaml = '# KitCore Essentials Configuration\n';
    yaml += '# All items can be picked up from the menu (drag and drop)\n\n';
    yaml += `# Main menu title\nmenu-title: "${data['menu-title']}"\n\n`;
    yaml += 'sections:\n';
    
    for (const [sectionKey, section] of Object.entries(data.sections)) {
        yaml += `  ${sectionKey}:\n`;
        yaml += `    icon: ${section.icon}\n`;
        yaml += `    name: "${section.name}"\n`;
        yaml += `    slot: ${section.slot}\n`;
        yaml += `    menu-title: "${section['menu-title']}"\n`;
        yaml += '    items:\n';
        
        for (const item of section.items) {
            yaml += `      - material: ${item.material}\n`;
            
            if (item.amount !== undefined && item.amount > 1) {
                yaml += `        amount: ${item.amount}\n`;
            }
            
            if (item.name) {
                yaml += `        name: "${item.name}"\n`;
            }
            
            if (item.lore && item.lore.length > 0) {
                yaml += '        lore:\n';
                for (const line of item.lore) {
                    yaml += `          - "${line}"\n`;
                }
            }
            
            if (item.enchantments && item.enchantments.length > 0) {
                yaml += '        enchantments:\n';
                for (const e of item.enchantments) {
                    yaml += `          - ${e.type}:${e.level}\n`;
                }
            }
            
            if (item.unbreakable) {
                yaml += '        unbreakable: true\n';
            }
            
            if (item.glow) {
                yaml += '        glow: true\n';
            }
            
            if (item['custom-model-data']) {
                yaml += `        custom-model-data: ${item['custom-model-data']}\n`;
            }
            
            if (item.flags && item.flags.length > 0) {
                yaml += '        flags:\n';
                for (const f of item.flags) {
                    yaml += `          - ${f}\n`;
                }
            }
            
            if (item.potion) {
                yaml += '        potion:\n';
                yaml += `          type: ${item.potion.type}\n`;
            }
            
            if (item.firework) {
                yaml += '        firework:\n';
                yaml += `          power: ${item.firework.power}\n`;
            }
        }
        yaml += '\n';
    }
    
    return yaml.trimEnd() + '\n';
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.method === 'GET' && req.url === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                res.end('Error loading page');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }
    
    if (req.method === 'GET' && req.url === '/api/config') {
        fs.readFile(YAML_PATH, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to read config' }));
                return;
            }
            try {
                const parsed = parseYaml(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(parsed));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to parse YAML: ' + e.message }));
            }
        });
        return;
    }
    
    if (req.method === 'POST' && req.url === '/api/config') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const yaml = toYaml(data);
                fs.writeFile(YAML_PATH, yaml, err => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Failed to save config' }));
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                });
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    res.writeHead(404);
    res.end('Not found');
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   ⚔️  KitCore Essentials Editor                        ║
║                                                        ║
║   Running at: http://localhost:${PORT}                   ║
║                                                        ║
║   Features:                                            ║
║   • Custom item names & lore                           ║
║   • Enchantments with levels                           ║
║   • NBT flags & options                                ║
║   • Upload/Download YAML                               ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);
});
