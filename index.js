import React, { useState, useEffect, useRef } from 'react';
app.listen(process.env.PORT || 3000)

const GravitySimulator = () => {
  const canvasRef = useRef(null);
  const [objects, setObjects] = useState([]);
  const [selectedType, setSelectedType] = useState('planet');
  const [dragging, setDragging] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [timeSpeed, setTimeSpeed] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const animationRef = useRef(null);

  const getObjectType = (mass) => {
    if (mass >= 5000000) return 'blackHole';
    if (mass >= 1400000) return 'neutronStar';
    if (mass >= 75000) return 'star';
    if (mass >= 0.2) return 'planet';
    if (mass >= 0.00005) return 'asteroid';
    return 'meteor';
  };

  const getObjectConfig = (mass) => {
    const type = getObjectType(mass);
    const configs = {
      meteor: { color: '#8B4513', glow: false },
      asteroid: { color: '#A9A9A9', glow: false },
      planet: { color: '#4169E1', glow: false },
      star: { color: '#FFD700', glow: true },
      neutronStar: { color: '#FF1493', glow: true },
      blackHole: { color: '#000000', glow: true, special: true }
    };
    
    const config = configs[type];
    const radius = Math.max(3, Math.min(35, 3 + Math.pow(mass, 0.15) * 2));
    
    return { ...config, radius, type };
  };

  const objectTypes = {
    meteor: { 
      mass: 0.00005,
      name: 'Meteor',
      realMass: '~1 kg'
    },
    asteroid: { 
      mass: 0.00005,
      name: 'Asteroid', 
      realMass: '~100,000 kg'
    },
    planet: { 
      mass: 0.2,
      name: 'Planet',
      realMass: '~0.05 Earth masses'
    },
    star: { 
      mass: 75000,
      name: 'Star',
      realMass: '~0.075 solar masses'
    },
    neutronStar: { 
      mass: 1400000,
      name: 'Neutron Star',
      realMass: '~1.4 solar masses'
    },
    blackHole: { 
      mass: 5000000,
      name: 'Black Hole',
      realMass: '~5 solar masses'
    }
  };

  // Tuned gravitational constant for realistic orbits
  const G = 0.5;

  const createSolarSystem = () => {
    const canvas = canvasRef.current;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Sun (massive central body)
    const sunMass = 100000;
    const sun = {
      x: centerX,
      y: centerY,
      vx: 0,
      vy: 0,
      mass: sunMass,
      radius: 25,
      color: '#FFA500',
      glow: true,
      special: false,
      type: 'star',
      name: 'Sun'
    };
    
    // Planet data: [name, distance, relative mass, color]
    const planetData = [
      ['Mercury', 90, 0.055, '#8B7355'],
      ['Venus', 125, 0.815, '#FFC649'],
      ['Earth', 160, 1.0, '#4169E1'],
      ['Mars', 195, 0.107, '#CD5C5C'],
      ['Jupiter', 260, 15, '#DAA520'],
      ['Saturn', 320, 9, '#F4A460'],
      ['Uranus', 380, 1.5, '#4FD0E0'],
      ['Neptune', 440, 1.7, '#4166F5']
    ];
    
    const planets = planetData.map(([name, dist, massScale, color]) => {
      // Calculate stable orbital velocity: v = sqrt(G * M / r)
      const orbitalSpeed = Math.sqrt((G * sunMass) / dist);
      
      return {
        x: centerX + dist,
        y: centerY,
        vx: 0,
        vy: orbitalSpeed,
        mass: massScale * 5,
        radius: Math.max(4, Math.min(16, 4 + Math.sqrt(massScale) * 1.2)),
        color: color,
        glow: false,
        special: false,
        type: 'planet',
        name: name
      };
    });
    
    setObjects([sun, ...planets]);
    setCamera({ x: centerX, y: centerY });
    setZoom(0.7);
    setTimeSpeed(1);
  };

  const screenToWorld = (screenX, screenY) => {
    const canvas = canvasRef.current;
    return {
      x: (screenX - canvas.width / 2) / zoom + camera.x,
      y: (screenY - canvas.height / 2) / zoom + camera.y
    };
  };

  const worldToScreen = (worldX, worldY) => {
    const canvas = canvasRef.current;
    return {
      x: (worldX - camera.x) * zoom + canvas.width / 2,
      y: (worldY - camera.y) * zoom + canvas.height / 2
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const updatePhysics = () => {
      if (isPaused) return;

      const steps = Math.max(1, Math.floor(timeSpeed));
      const stepSize = timeSpeed / steps;

      for (let step = 0; step < steps; step++) {
        setObjects(prevObjects => {
          let newObjects = prevObjects.map(obj => ({ ...obj }));
          const toRemove = new Set();
          
          // Check for collisions
          for (let i = 0; i < newObjects.length; i++) {
            if (toRemove.has(i)) continue;
            
            for (let j = i + 1; j < newObjects.length; j++) {
              if (toRemove.has(j)) continue;
              
              const dx = newObjects[j].x - newObjects[i].x;
              const dy = newObjects[j].y - newObjects[i].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              
              if (dist < (newObjects[i].radius + newObjects[j].radius) / 2) {
                const totalMass = newObjects[i].mass + newObjects[j].mass;
                const totalMomentumX = newObjects[i].mass * newObjects[i].vx + newObjects[j].mass * newObjects[j].vx;
                const totalMomentumY = newObjects[i].mass * newObjects[i].vy + newObjects[j].mass * newObjects[j].vy;
                
                const newX = (newObjects[i].x * newObjects[i].mass + newObjects[j].x * newObjects[j].mass) / totalMass;
                const newY = (newObjects[i].y * newObjects[i].mass + newObjects[j].y * newObjects[j].mass) / totalMass;
                
                const config = getObjectConfig(totalMass);
                
                newObjects[i] = {
                  x: newX,
                  y: newY,
                  vx: totalMomentumX / totalMass,
                  vy: totalMomentumY / totalMass,
                  mass: totalMass,
                  radius: config.radius,
                  color: config.color,
                  glow: config.glow,
                  special: config.special,
                  type: config.type
                };
                
                toRemove.add(j);
              }
            }
          }
          
          newObjects = newObjects.filter((_, idx) => !toRemove.has(idx));
          
          // Calculate gravitational forces
          for (let i = 0; i < newObjects.length; i++) {
            let fx = 0, fy = 0;
            
            for (let j = 0; j < newObjects.length; j++) {
              if (i === j) continue;
              
              const dx = newObjects[j].x - newObjects[i].x;
              const dy = newObjects[j].y - newObjects[i].y;
              const distSq = dx * dx + dy * dy;
              const dist = Math.sqrt(distSq);
              
              if (dist < 1) continue;
              
              const force = (G * newObjects[i].mass * newObjects[j].mass) / distSq;
              fx += (force * dx) / dist;
              fy += (force * dy) / dist;
            }
            
            newObjects[i].vx += (fx / newObjects[i].mass) * stepSize;
            newObjects[i].vy += (fy / newObjects[i].mass) * stepSize;
            
            newObjects[i].x += newObjects[i].vx * stepSize;
            newObjects[i].y += newObjects[i].vy * stepSize;
          }
          
          return newObjects;
        });
      }
    };

    const draw = () => {
      ctx.fillStyle = '#000814';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      objects.forEach(obj => {
        const screen = worldToScreen(obj.x, obj.y);
        const screenRadius = obj.radius * zoom;
        
        if (screen.x + screenRadius < 0 || screen.x - screenRadius > canvas.width ||
            screen.y + screenRadius < 0 || screen.y - screenRadius > canvas.height) {
          return;
        }
        
        if (obj.glow) {
          const gradient = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, screenRadius * 2);
          gradient.addColorStop(0, obj.color + '40');
          gradient.addColorStop(1, obj.color + '00');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, screenRadius * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, screenRadius, 0, Math.PI * 2);
        ctx.fill();
        
        if (obj.special) {
          ctx.strokeStyle = '#4B0082';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(screen.x, screen.y, screenRadius * 1.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        if (zoom > 0.5 && obj.name) {
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `${10 * Math.min(zoom, 1)}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(obj.name, screen.x, screen.y + screenRadius + 12 * zoom);
        }
      });
      
      if (dragging && dragStart) {
        const dragScreen = worldToScreen(dragging.x, dragging.y);
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(dragScreen.x, dragScreen.y);
        ctx.lineTo(dragStart.x, dragStart.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        const angle = Math.atan2(dragStart.y - dragScreen.y, dragStart.x - dragScreen.x);
        ctx.beginPath();
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(dragStart.x - 10 * Math.cos(angle - Math.PI / 6), dragStart.y - 10 * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(dragStart.x, dragStart.y);
        ctx.lineTo(dragStart.x - 10 * Math.cos(angle + Math.PI / 6), dragStart.y - 10 * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Zoom: ${zoom.toFixed(2)}x`, 10, 20);
      ctx.fillText(`Speed: ${timeSpeed.toFixed(1)}x`, 10, 40);
    };

    const animate = () => {
      updatePhysics();
      draw();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [objects, dragging, dragStart, isPaused, timeSpeed, zoom, camera]);

  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    if (e.button === 2) {
      setPanning(true);
      setPanStart({ x: screenX, y: screenY });
      return;
    }
    
    const world = screenToWorld(screenX, screenY);
    const mass = objectTypes[selectedType].mass;
    const config = getObjectConfig(mass);
    
    const newObj = {
      x: world.x,
      y: world.y,
      vx: 0, vy: 0,
      mass: mass,
      radius: config.radius,
      color: config.color,
      glow: config.glow,
      special: config.special,
      type: config.type
    };
    
    setDragging(newObj);
    setDragStart({ x: screenX, y: screenY });
  };

  const handleCanvasMouseMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    if (panning && panStart) {
      const dx = (screenX - panStart.x) / zoom;
      const dy = (screenY - panStart.y) / zoom;
      setCamera(prev => ({
        x: prev.x - dx,
        y: prev.y - dy
      }));
      setPanStart({ x: screenX, y: screenY });
      return;
    }
    
    if (!dragging) return;
    setDragStart({ x: screenX, y: screenY });
  };

  const handleCanvasMouseUp = (e) => {
    if (panning) {
      setPanning(false);
      setPanStart(null);
      return;
    }
    
    if (!dragging || !dragStart) return;
    
    const dragScreen = worldToScreen(dragging.x, dragging.y);
    const velocityScale = 0.02;
    dragging.vx = (dragStart.x - dragScreen.x) * velocityScale / zoom;
    dragging.vy = (dragStart.y - dragScreen.y) * velocityScale / zoom;
    
    setObjects(prev => [...prev, dragging]);
    setDragging(null);
    setDragStart(null);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
  };

  return (
    <div className="w-full h-screen bg-gray-900 flex flex-col">
      <div className="bg-gray-800 p-4 shadow-lg">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-white mb-4">Gravity Simulator</h1>
          
          <div className="mb-4 bg-gray-700 p-3 rounded-lg">
            <div className="flex items-center gap-4">
              <label className="text-white font-medium min-w-fit">Time Speed:</label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={timeSpeed}
                onChange={(e) => setTimeSpeed(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-white font-mono min-w-fit">{timeSpeed.toFixed(1)}x</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-3">
            {Object.entries(objectTypes).map(([key, config]) => {
              const objConfig = getObjectConfig(config.mass);
              return (
                <button
                  key={key}
                  onClick={() => setSelectedType(key)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedType === key
                      ? 'bg-blue-600 text-white scale-105'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: objConfig.color, border: objConfig.special ? '2px solid #4B0082' : 'none' }}
                      />
                      {config.name}
                    </div>
                    <span className="text-xs text-gray-400">{config.realMass}</span>
                  </div>
                </button>
              );
            })}
          </div>
          
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={createSolarSystem}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              Solar System
            </button>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium"
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => setObjects([])}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
            >
              Clear All
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setCamera({ x: 0, y: 0 });
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
            >
              Reset View
            </button>
            <div className="text-gray-300 px-4 py-2">
              Objects: {objects.length}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={1200}
          height={700}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
          className="border-4 border-gray-700 rounded-lg cursor-crosshair bg-black"
        />
      </div>
      
      <div className="bg-gray-800 p-3 text-center text-gray-400 text-sm">
        Left Click & Drag: Place objects • Right Click & Drag: Pan • Scroll: Zoom • Solar System uses real planetary data with tuned physics
      </div>
    </div>
  );
};

export default GravitySimulator;
