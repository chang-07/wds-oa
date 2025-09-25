import React, { useState, useEffect, useRef } from 'react';
import './ChatWindow.css';

const ChatWindow = ({ currentUserId, newChannel }) => {
  const [channels, setChannels] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const audioRef = useRef(null);

  const fetchChannelMessages = async (channelId) => {
    if (!channelId) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`http://localhost:5001/api/channels/${channelId}`, {
        headers: {
          'x-auth-token': token,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setChannels(prevChannels => {
          const updatedChannels = prevChannels.map(c => {
            if (c._id === channelId) {
              const oldMessages = c.messages || [];
              const newMessages = data.messages;

              // Check for new messages not sent by current user
              if (newMessages.length > oldMessages.length) {
                const lastNewMessage = newMessages[newMessages.length - 1];
                if (lastNewMessage.sender && lastNewMessage.sender._id !== currentUserId) {
                  if (audioRef.current) { // Check if audio element exists
                    audioRef.current.play().catch(error => {
                      console.error("Error playing ping sound:", error);
                      // This catch block will help us see if autoplay is blocked
                    });
                  }
                }
              }
              return { ...c, messages: newMessages };
            }
            return c;
          });
          return updatedChannels;
        });
      } else {
        console.error('Failed to fetch messages:', data.msg);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // New: Function to fetch all channels for the current user
  const fetchUserChannels = async () => {
    if (!currentUserId) return;
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`http://localhost:5001/api/channels/user/${currentUserId}`, { // <--- NEW ENDPOINT NEEDED
        headers: {
          'x-auth-token': token,
        },
      });
      const data = await res.json();
      console.log('Channels fetched from backend (fetchUserChannels):', data); // New log
      if (res.ok) {
        setChannels(data); // Set all channels from backend

        // Set active tab: prioritize newChannel, then existing activeTab, then first fetched channel
        if (newChannel) {
          setActiveTab(newChannel._id);
          console.log('Active tab set to newChannel:', newChannel._id); // New log
        } else if (activeTab && data.some(c => c._id === activeTab)) {
          // Keep activeTab if it still exists in the fetched data
          setActiveTab(activeTab);
          console.log('Active tab kept:', activeTab); // New log
        } else if (data.length > 0) {
          setActiveTab(data[0]._id); // Default to first channel
          console.log('Active tab set to first channel:', data[0]._id); // New log
        } else {
          setActiveTab(null); // No channels
          console.log('Active tab set to null (no channels)'); // New log
        }
      } else {
        console.error('Failed to fetch user channels:', data.msg);
      }
    } catch (error) {
      console.error('Error fetching user channels:', error);
    }
  };

  // New: Fetch user channels on mount or when currentUserId changes
  useEffect(() => {
    fetchUserChannels();
  }, [currentUserId, newChannel]); // Add newChannel as a dependency

  useEffect(() => {
    if (chatOpen && currentUserId && activeTab) {
      fetchChannelMessages(activeTab);
      // Poll for new messages every few seconds (can be replaced by WebSockets)
      const interval = setInterval(() => fetchChannelMessages(activeTab), 5000);
      return () => clearInterval(interval);
    }
  }, [chatOpen, currentUserId, activeTab]);

  const handleSendMessage = async () => {
    if (!activeTab || !newMessage.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5001/api/channels/${activeTab}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token,
        },
        body: JSON.stringify({ content: newMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        setChannels(prevChannels => prevChannels.map(c => c._id === activeTab ? { ...c, messages: [...(c.messages || []), data] } : c));
        setNewMessage('');
      } else {
        console.error('Failed to send message:', data.msg);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className={`chat-window ${chatOpen ? 'open' : ''}`}>
      <audio ref={audioRef} src="/ping.mp3" preload="auto" />
      <div className="chat-header" onClick={() => setChatOpen(!chatOpen)}>
        <h2>Messages</h2>
        <span>{chatOpen ? '—' : '+'}</span>
      </div>
      {chatOpen && (
        <div className="chat-main">
          <div className="chat-tabs">
            {channels.map(channel => (
              <div
                key={channel._id}
                className={`chat-tab ${activeTab === channel._id ? 'active' : ''}`}
                onClick={() => setActiveTab(channel._id)}
              >
                {channel.messages[0]?.content || 'New Channel'}
              </div>
            ))}
          </div>
          <div className="chat-body">
            {channels.find(c => c._id === activeTab)?.messages?.length === 0 ? (
              <p>No messages yet.</p>
            ) : (
              channels.find(c => c._id === activeTab)?.messages?.map((msg) => {
                console.log('Rendering message:', msg, 'currentUserId:', currentUserId);
                const isSent = msg.sender && msg.sender._id === currentUserId;
                console.log('isSent:', isSent, 'msg.sender._id:', msg.sender?._id, 'currentUserId:', currentUserId);
                return (
                  <div key={msg._id} className={`chat-message ${isSent ? 'sent' : 'received'}`}>
                    <span className="message-sender">{msg.sender ? msg.sender.username : 'Unknown'}: </span>
                    <span className="message-content">{msg.content}</span>
                    <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
      {chatOpen && (
        <div className="chat-footer">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
          />
          <button onClick={handleSendMessage}>Send</button>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;