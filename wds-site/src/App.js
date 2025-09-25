import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import Draggable from 'react-draggable';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import SignupPage from './components/SignupPage';
import { jwtDecode } from 'jwt-decode';
import ChatWindow from './components/ChatWindow';

const pastelColors = ['#a2d9a2', '#a7c7e7', '#ffb3ba', '#ffdfba'];

const Bubble = ({ bubble, onDragStart, onDragStop, onPopBubble, currentUserId }) => {
  const nodeRef = useRef(null);
  const textContentRef = useRef(null);
  const [fontSize, setFontSize] = useState(16);
  const [isPopping, setIsPopping] = useState(false); // New state for animation

  console.log('Bubble color in Bubble component:', bubble.color);

  useEffect(() => {
    const adjustFontSize = () => {
      const bubbleInnerWidth = 180;
      const bubbleInnerHeight = 180;

      let currentFontSize = 36;

      if (textContentRef.current) {
        textContentRef.current.style.fontSize = `${currentFontSize}px`;
      }

      while (currentFontSize > 8 && textContentRef.current) {
        const textWidth = textContentRef.current.scrollWidth;
        const textHeight = textContentRef.current.scrollHeight;

        if (textWidth > bubbleInnerWidth || textHeight > bubbleInnerHeight) {
          currentFontSize -= 1;
          textContentRef.current.style.fontSize = `${currentFontSize}px`;
        } else {
          break;
        }
      }
      setFontSize(currentFontSize);
    };

    adjustFontSize();
    window.addEventListener('resize', adjustFontSize);
    return () => window.removeEventListener('resize', adjustFontSize);
  }, [bubble.text]);

  const handleDoubleClick = () => {
    if (bubble.creator._id !== currentUserId) {
      setIsPopping(true); // Start pop animation
      setTimeout(() => {
        onPopBubble(bubble._id, bubble.creator._id, bubble.text);
      }, 300); // Match this duration with CSS animation duration
    }
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      onStart={() => onDragStart(bubble._id)} // Use _id from MongoDB
      onStop={(e, data) => onDragStop(bubble._id, { x: data.x, y: data.y })} // Use _id from MongoDB
      position={bubble.position}
    >
      <div
        className={isPopping ? 'bubble popping' : 'bubble'} // Apply 'popping' class
        ref={nodeRef}
        style={{ '--bubble-color': bubble.color }}
        onDoubleClick={handleDoubleClick} // Use new handler
      > {/* Use _id and creator._id */}
        <div className="bubble-text-content" ref={textContentRef} style={{ fontSize: `${fontSize}px` }}>
          {bubble.text}
        </div>
      </div>
    </Draggable>
  );
};

const BubblePage = ({ isAuthenticated, onLogout, currentUserId, onPopBubble }) => {
  const [inputValue, setInputValue] = useState('');
  const [bubbles, setBubbles] = useState([]); // This will now be fetched from DB
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Function to fetch bubbles from the backend
  const fetchBubbles = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5001/api/bubbles');
      const data = await res.json();
      if (res.ok) {
        // Map fetched bubbles to include isDragging state for local management
        setBubbles(data.map(b => ({ ...b, isDragging: false })));
      } else {
        console.error('Failed to fetch bubbles:', data.msg);
      }
    } catch (error) {
      console.error('Error fetching bubbles:', error);
    }
  }, []);

  // Polling for real-time updates
  useEffect(() => {
    fetchBubbles(); // Initial fetch
    const interval = setInterval(fetchBubbles, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [fetchBubbles]);


  // Physics simulation for attraction/repulsion
  useEffect(() => {
    let animationFrameId;

    const animate = () => {
      setBubbles(currentBubbles => {
        return currentBubbles.map(bubble => {
          // If bubble is being dragged, its position is handled by react-draggable
          if (bubble.isDragging) {
            return bubble;
          }

          let force = { x: 0, y: 0 };
          const bubbleRadius = 110; // Half of bubble width/height
          const minDistance = bubbleRadius * 2; // Minimum distance between bubble centers

          currentBubbles.forEach(otherBubble => {
            if (otherBubble._id !== bubble._id) { // Use _id for comparison
              const dx = otherBubble.position.x - bubble.position.x;
              const dy = otherBubble.position.y - bubble.position.y;
              const distance = Math.sqrt(dx * dx + dy * dy);

              // Redesigned physics engine: no repulsion unless overlapping, attraction approaches 0 at minDistance
              // Redesigned physics engine: smooth attraction and gentle overlap repulsion
              const attractionStrength = 0.02; // Constant attraction, adjust for overall clumping
              const overlapRepulsionStrength = 5; // Adjust for how strongly they repel when overlapping

              // Apply attraction only when not overlapping
              if (distance >= minDistance) {
                const attractionStrength = 0.02; // Constant attraction, adjust for overall clumping
                if (distance > 0.1) { // Prevent division by zero for direction
                  force.x += (dx / distance) * attractionStrength;
                  force.y += (dy / distance) * attractionStrength;
                }
              }

              // Apply repulsion only when overlapping
              if (distance < minDistance) {
                const constantRepulsion = 0.5; // Very slight constant repulsion, adjust as needed

                // Add a failsafe for extremely small distances to prevent NaN
                if (distance < 0.1) {
                    const effectiveDx = dx === 0 ? (Math.random() - 0.5) * 0.01 : dx;
                    const effectiveDy = dy === 0 ? (Math.random() - 0.5) * 0.01 : dy;
                    const effectiveDistance = Math.sqrt(effectiveDx * effectiveDx + effectiveDy * effectiveDy);
                    force.x -= (effectiveDx / effectiveDistance) * 50; // Strong push for extreme overlap
                    force.y -= (effectiveDy / effectiveDistance) * 50;
                } else {
                    force.x -= (dx / distance) * constantRepulsion; // Apply constant repulsion
                    force.y -= (dy / distance) * constantRepulsion;
                }
              }
            }
          });

          // Apply damping to prevent infinite oscillation
          const damping = 0.99;
          const maxForce = 30; // Limit maximum force

          force.x = Math.max(-maxForce, Math.min(maxForce, force.x * damping));
          force.y = Math.max(-maxForce, Math.min(maxForce, force.y * damping));

          // Update position
          let newX = bubble.position.x + force.x;
          let newY = bubble.position.y + force.y;

          // Boundary collision (simple bounce)
          const screenWidth = window.innerWidth;
          const screenHeight = window.innerHeight;

          if (newX - bubbleRadius < 0) {
            newX = bubbleRadius;
            force.x *= -1; // Reverse force direction
          } else if (newX + bubbleRadius > screenWidth) {
            newX = screenWidth - bubbleRadius;
            force.x *= -1; // Reverse force direction
          }

          if (newY - bubbleRadius < 0) {
            newY = bubbleRadius;
            force.y *= -1; // Reverse force direction
          } else if (newY + bubbleRadius > screenHeight) {
            newY = screenHeight - bubbleRadius; // Use bubbleRadius for consistency
            force.y *= -1; // Reverse force direction
          }


          return {
            ...bubble,
            position: {
              x: newX,
              y: newY,
            },
          };
        });
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, []); 


  const handleInputChange = (event) => {
    setInputValue(event.target.value);
  };

  const handleSubmit = async () => {
    if (inputValue.trim() !== '' && currentUserId) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5001/api/bubbles', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token,
          },
          body: JSON.stringify({
            text: inputValue,
            position: { x: Math.random() * 300, y: Math.random() * 300 },
            color: pastelColors[Math.floor(Math.random() * pastelColors.length)],
          }),
        });
        const data = await res.json();
        console.log('New bubble data from backend:', data);
        if (res.ok) {
          // Add the newly created bubble to local state
          setBubbles(prevBubbles => [...prevBubbles, { ...data, isDragging: false }]);
          setInputValue('');
        } else {
          console.error('Failed to create bubble:', data.msg);
        }
      } catch (error) {
        console.error('Error creating bubble:', error);
      }
    }
  };

  const handleDragStart = (id) => {
    setBubbles(bubbles.map(b => b._id === id ? { ...b, isDragging: true } : b));
  };

  const handleDragStop = async (id, newPosition) => {
    setBubbles(bubbles.map(b => b._id === id ? { ...b, isDragging: false, position: newPosition } : b));
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5001/api/bubbles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify(newPosition),
      });
    } catch (error) {
      console.error('Error updating bubble position:', error);
    }
  };

  

  const handleWheel = (e) => {
    e.preventDefault();
    setScale(scale => Math.min(Math.max(0.5, scale - e.deltaY * 0.001), 2));
  };

  const handleMouseDown = (e) => {
    if (!e.target.classList.contains('bubble') && !e.target.closest('.notion-container')) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPanOffset(offset => ({ x: offset.x + dx, y: offset.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  return (
    <div 
      className="App" 
      onWheel={handleWheel} 
      onMouseDown={handleMouseDown} 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp}
      style={{
          backgroundImage: `
            radial-gradient(circle at center, rgba(0, 0, 0, 0.8) 1px, transparent 1px)
          `,
          backgroundSize: `${40 / scale}px ${40 / scale}px`
        }}
    >
      {isAuthenticated && (
        <button className="logout-button" onClick={onLogout} title="Logout">
          →
        </button>
      )}
      <div className="zoom-container" style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})` }}>
        <header className="App-header">
          {bubbles.map((bubble) => (
            <Bubble
              key={bubble._id} // Use _id from MongoDB
              bubble={bubble}
              onDragStart={handleDragStart}
              onDragStop={handleDragStop}
              onPopBubble={(bubbleId, creatorId, content) => onPopBubble(bubbleId, creatorId, content)}
              currentUserId={currentUserId}
            />
          ))}
        </header>
      </div>
      <div className="notion-container">
        <input
          type="text"
          className="notion-input"
          placeholder="Enter text..."
          value={inputValue}
          onChange={handleInputChange}
        />
        <button className="notion-button" onClick={handleSubmit}>
          Submit
        </button>
      </div>
      
    </div>
  );
};


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [newChannel, setNewChannel] = useState(null);

  const handlePopBubble = async (bubbleId, creatorId, content) => {
    // Always create a channel when a bubble is clicked, regardless of who created it
    if (creatorId) {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('http://localhost:5001/api/channels', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token,
          },
          body: JSON.stringify({ 
            receiverId: creatorId, 
            content, 
            senderId: creatorId // The bubble creator is the sender of the message
          }),
        });
        const channel = await res.json();
          console.log('Channel created from backend (handlePopBubble):', channel); // New log
          if (res.ok) {
            setNewChannel(channel);
            console.log('setNewChannel called with:', channel); // New log
            console.log('Channel created successfully!');
        } else {
          console.error('Failed to create channel:', channel.msg);
        }
      } catch (error) {
        console.error('Error creating channel:', error);
      }
    }
    // Delete bubble from DB
    try {
      const token = localStorage.getItem('token');
      await fetch(`http://localhost:5001/api/bubbles/${bubbleId}`, {
        method: 'DELETE',
        headers: {
          'x-auth-token': token,
        },
      });
      // Bubbles will be refetched, so no need to remove from local state
    } catch (error) {
      console.error('Error deleting bubble:', error);
    }
  };


  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setCurrentUserId(decoded.user.id);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to decode token:', error);
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      }
    }
  }, []);

  const handleLoginSuccess = () => {
    const token = localStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode(token);
      setCurrentUserId(decoded.user.id);
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setCurrentUserId(null);
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <BubblePage isAuthenticated={isAuthenticated} onLogout={handleLogout} currentUserId={currentUserId} onPopBubble={handlePopBubble} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
      {isAuthenticated && <ChatWindow currentUserId={currentUserId} newChannel={newChannel} />}
    </Router>
  );
}

export default App;