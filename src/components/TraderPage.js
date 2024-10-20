import React, { useEffect, useState } from 'react';
import { getDocs, collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { format } from 'date-fns'; // Add this to format the timestamp

const AgentDashboardTrader = () => {
  const navigate = useNavigate();
  
  const [price, setPrice] = useState(0);
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [agentId, setAgentId] = useState(null);
  const [agentName, setAgentName] = useState(null);
  const [currentOrders, setCurrentOrders] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showFillOrderModal, setShowFillOrderModal] = useState(false);
  const [showMessagesModal, setShowMessagesModal] = useState(false);
  const [messages, setMessages] = useState([]);

  // Fetch agent and transactions on component mount
  useEffect(() => {
    const fetchAgentAndTransactions = async () => {
      const user = auth.currentUser;
      if (!user) return;
  
      const userUid = user.uid;
      try {
        const agentsSnapshot = await getDocs(collection(db, 'agents'));
        let foundAgentId = null;
  
        agentsSnapshot.forEach((doc) => {
          const agentData = doc.data();
          if (agentData.agent_users?.includes(userUid)) {
            foundAgentId = doc.id;
            setAgentName(agentData.name);
          }
        });
  
        if (foundAgentId) {
          setAgentId(foundAgentId);
          const transactionsRef = collection(db, 'transactions');
          const q = query(transactionsRef, where('AssignedAgents', 'array-contains', foundAgentId));
  
          const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const fetchTransactions = async () => {
              const transactions = await Promise.all(querySnapshot.docs.map(async (doc) => {
                const transactionData = doc.data();
  
                // Real-time listener for messages for each transaction
                const messagesRef = collection(db, 'messages_agents');
                const messagesQuery = query(
                  messagesRef,
                  where('transactionId', '==', doc.id),
                  where('agentId', '==', foundAgentId)
                );
  
                onSnapshot(messagesQuery, (messagesSnapshot) => {
                  const messageCount = messagesSnapshot.size;
                  const amountTotal = messagesSnapshot.docs.reduce((sum, messageDoc) => {
                    const messageData = messageDoc.data();
                    return sum + (messageData.amount || 0);
                  }, 0);
  
                  // Update the transaction with message count and amount total
                  setCurrentOrders((prevOrders) => {
                    return prevOrders.map((order) => {
                      if (order.id === doc.id) {
                        return {
                          ...order,
                          messageCount,
                          amountTotal,
                        };
                      }
                      return order;
                    });
                  });
  
                  setPastOrders((prevOrders) => {
                    return prevOrders.map((order) => {
                      if (order.id === doc.id) {
                        return {
                          ...order,
                          messageCount,
                          amountTotal,
                        };
                      }
                      return order;
                    });
                  });
                });
  
                return { id: doc.id, ...transactionData };
              }));
  
              const current = transactions.filter((t) => t.status === 'In-Progress');
              const past = transactions.filter((t) => t.status !== 'In-Progress');
  
              setCurrentOrders(current);
              setPastOrders(past);
            };
            fetchTransactions();
          });
  
          return () => unsubscribe();
        }
      } catch (error) {
        console.error('Error fetching agent or transactions:', error);
      }
    };
  
    fetchAgentAndTransactions();
  }, []);
    
  // Fetch messages for the selected transaction
  useEffect(() => {
    if (selectedTransaction && agentId) {
      const messagesQuery = query(
        collection(db, 'messages_agents'),
        where('transactionId', '==', selectedTransaction.id),
        where('agentId', '==', agentId)
      );

      const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        const fetchedMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        
        // Sort messages by timestamp (ascending order)
        const sortedMessages = fetchedMessages.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
        
        setMessages(sortedMessages);
      });

      return () => unsubscribeMessages();
    }
  }, [selectedTransaction, agentId]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const handleFillOrder = () => {
    if (!selectedTransaction) return;

    const messageData = {
      agentId,
      transactionId: selectedTransaction.id,
      timestamp: new Date(),
      price: parseFloat(price),
      amount: parseFloat(amount),
      notes,
      type: 'agent_fill',
      agentName,
    };

    addDoc(collection(db, 'messages_agents'), messageData)
      .then(() => {
        setShowFillOrderModal(false);
        resetForm();
      })
      .catch((error) => console.error('Error filling order:', error));
  };

  const resetForm = () => {
    setPrice('');
    setAmount('');
    setNotes('');
  };

  const renderTable = (title, transactions, showActions = true) => {
    // Sort transactions from newest to oldest based on `systemdate`
    const sortedTransactions = transactions.sort((a, b) => {
      const aDate = a.systemdate ? new Date(a.systemdate).getTime() : 0;
      const bDate = b.systemdate ? new Date(b.systemdate).getTime() : 0;
      return bDate - aDate;
    });
  
    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <table className="min-w-full border border-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th className="border border-gray-700 p-4">Date</th>
              <th className="border border-gray-700 p-4">Minimum Price</th> {/* New column for bet */}
              <th className="border border-gray-700 p-4">Details</th>
              <th className="border border-gray-700 p-4">Status</th>
              <th className="border border-gray-700 p-4">Message Count</th>
              <th className="border border-gray-700 p-4">Amount Total</th>
              <th className="border border-gray-700 p-4">Actions</th> {/* Keep actions for both tables */}
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((transaction) => {
              const [team, value] = transaction.bet ? transaction.bet.split('@').map(str => str.trim()) : ['', ''];
              const minimumPrice = `${team} @ ${transaction.seekprice || value}`;
  
              return (
                <tr key={transaction.id}>
                  <td className="border border-gray-700 p-4">
                    {transaction.systemdate 
                      ? format(new Date(transaction.systemdate), 'MM/dd/yyyy HH:mm')
                      : 'N/A'}
                  </td>
                  <td className="border border-gray-700 p-4">
                    {minimumPrice || 'N/A'}
                  </td>
                  <td className="border border-gray-700 p-4">
                    {`${transaction.event || ''}, ${transaction.league || ''}, ${transaction.market || ''}`}
                  </td>
                  <td className="border border-gray-700 p-4">{transaction.status}</td>
                  <td className="border border-gray-700 p-4">{transaction.messageCount || 0}</td>
                  <td className="border border-gray-700 p-4">{transaction.amountTotal || 0}</td>
  
                  {/* Conditional rendering for actions */}
                  <td className="border border-gray-700 p-4">
                    {title === 'Current Orders' && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setShowFillOrderModal(true);
                          }}
                          className="bg-blue-600 text-white p-2 rounded m-1"
                        >
                          Fill Order
                        </button>
                        <button
                          onClick={() => handleFinishOrder(transaction)}
                          className="bg-green-600 text-white p-2 rounded m-1"
                        >
                          Finish
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        setSelectedTransaction(transaction);
                        setShowMessagesModal(true);
                      }}
                      className="bg-yellow-600 text-white p-2 rounded m-1"
                    >
                      View Messages
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };
 
  const renderMessage = (message) => {
    let content = null;
    let containerClass = 'p-2 bg-gray-700 rounded'; // Default container style
  
    switch (message.type) {
      case 'assign':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Seek Price: ${message.seekprice || 0}, Bet Limit: ${message.betlimit || ''}`}</div>
          </>
        );
        break;
  
      case 'agent_finish':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Agent: ${message.agentName || ''}, Message: ${message.message || ''}`}</div>
          </>
        );
        containerClass += ' ml-4 bg-green-700'; // Indent and color change for agent_finish
        break;
  
      case 'agent_fill':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Price: ${message.price || 0}, Amount: ${message.amount || 0}, Notes: ${message.notes || ''}, Agent: ${message.agentName || ''}`}</div>
          </>
        );
        containerClass += ' ml-4 bg-blue-700'; // Indent and color change for agent_fill
        break;

      case 'close':
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Message: ${message.message || ''}`}</div>
          </>
        );
        break;
  
      default:
        content = (
          <>
            <div>{`Date: ${formatDate(message.timestamp)}`}</div>
            <div>{`Type: ${message.type}, Amount: ${message.amount || 0}, Notes: ${message.notes || ''}`}</div>
          </>
        );
        break;
    }
  
    return (
      <li key={message.id} className={containerClass}>
        {content}
      </li>
    );
  };
  
  const handleFinishOrder = (transaction) => {
    const messageData = {
      agentId,
      transactionId: transaction.id,
      timestamp: new Date(),
      message: 'Stopped filling order',
      type: 'agent_finish',
      agentName,
    };

    addDoc(collection(db, 'messages_agents'), messageData)
      .then(() => console.log('Order finished successfully'))
      .catch((error) => console.error('Error finishing order:', error));
  };

  // Instead of: new Date(timestamp.seconds * 1000)
  // Use Firestore's toDate() method if it's a Firestore Timestamp object
  const formatDate = (timestamp) => {
    return timestamp && timestamp.toDate 
      ? format(timestamp.toDate(), 'MM/dd/yyyy HH:mm') 
      : 'N/A';
  };


  return (
    <div className="relative bg-gray-900 text-white p-4 min-h-screen">
      {/* Logout Button */}
      <button onClick={handleLogout} className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded shadow-md hover:bg-red-600">
        Logout
      </button>
      {/* New-Request Button */}
      <button
      onClick={() => navigate('/submit-request-trader')}  // Add this button for Reports
      className="absolute top-4 right-44 bg-blue-500 text-white p-2 rounded shadow-md hover:bg-blue-600"
      >
      Trader Start
      </button>  

      <h1 className="text-3xl font-bold mb-6">Trader Dashboard</h1>
      {agentId && agentName && <h2 className="text-xl mb-4">Welcome, {agentName} (Agent ID: {agentId})</h2>}
      {renderTable('Current Orders', currentOrders)}
      {renderTable('Past Orders', pastOrders, true)}

      {/* Fill Order Modal */}
      {showFillOrderModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded shadow-lg text-white">
            <h3 className="text-lg font-bold">Fill Order</h3>
            <div className="mt-4">
              <label className="block mb-2">
                Price:
                <input
                  type="text"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                />
              </label>
              <label className="block mb-2">
                Amount:
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                />
              </label>
              <label className="block mb-2">
                Notes:
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                />
              </label>
              <div className="mt-4">
                <button onClick={handleFillOrder} className="bg-blue-600 text-white p-2 rounded mr-2">
                  Submit
                </button>
                <button onClick={() => setShowFillOrderModal(false)} className="bg-gray-500 text-white p-2 rounded">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Messages Modal */}
      {showMessagesModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded shadow-lg text-white">
            <h3 className="text-lg font-bold">Messages for Transaction</h3>
            <ul className="mt-4 space-y-2">
              {messages.map((message) => renderMessage(message))}
            </ul>
            <button onClick={() => setShowMessagesModal(false)} className="bg-gray-500 text-white p-2 rounded mt-4">
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default AgentDashboardTrader;