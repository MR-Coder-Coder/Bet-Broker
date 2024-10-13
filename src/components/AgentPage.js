import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';

const AgentDashboard = () => {
  const navigate = useNavigate();
  
  const [price, setPrice] = useState(0);
  const [amount, setAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [agentId, setAgentId] = useState(null);
  const [agentName, setAgentName] = useState(null);
  const [currentOrders, setCurrentOrders] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchAgentIdAndTransactions = async () => {
      // Get the current user's UID
      const user = auth.currentUser;
      if (!user) return;
      const userUid = user.uid;

      try {
        // Fetch all agents to find the agent ID associated with the user's UID
        const agentsSnapshot = await getDocs(collection(db, 'agents'));
        let foundAgentId = null;
        agentsSnapshot.forEach((doc) => {
          const agentData = doc.data();
          if (agentData.agent_users && agentData.agent_users.includes(userUid)) {
            foundAgentId = doc.id;
            setAgentName(agentData.name);
          }
        });

        if (foundAgentId) {
          setAgentId(foundAgentId);

          // Set up a real-time listener for transactions involving the agent ID
          const transactionsRef = collection(db, 'transactions');
          const q = query(transactionsRef, where('AssignedAgents', 'array-contains', foundAgentId));
          const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const relevantTransactions = [];
            for (const doc of querySnapshot.docs) {
              const transactionData = doc.data();
              const messagesSnapshot = await getDocs(query(collection(db, 'messages_agents'), where('transactionId', '==', doc.id)));
              transactionData.messageCount = messagesSnapshot.size;
              transactionData.amountTotal = messagesSnapshot.docs.reduce((sum, messageDoc) => {
                const messageData = messageDoc.data();
                return sum + (messageData.amount || 0);
              }, 0);
              relevantTransactions.push({ id: doc.id, ...transactionData });
            }

            // Split transactions into current and past orders
            const current = relevantTransactions.filter((transaction) => transaction.status === 'In-Progress');
            const past = relevantTransactions.filter((transaction) => transaction.status !== 'In-Progress');

            setCurrentOrders(current);
            setPastOrders(past);
          });

          // Cleanup function to unsubscribe from the listener when the component unmounts
          return () => unsubscribe();
        }
      } catch (error) {
        console.error('Error fetching agent or transactions:', error);
      }
    };

    fetchAgentIdAndTransactions();
  }, []);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/'); // Navigate to login page after logging out
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const renderTable = (title, transactions, showActions = true) => (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <table className="min-w-full border border-gray-700">
        <thead className="bg-gray-800">
          <tr>
            <th className="border border-gray-700 p-4">Transaction ID</th>
            <th className="border border-gray-700 p-4">Details</th>
            <th className="border border-gray-700 p-4">Status</th>
            <th className="border border-gray-700 p-4">Message Count</th>
            <th className="border border-gray-700 p-4">Amount Total</th>
            {showActions && <th className="border border-gray-700 p-4">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className="border border-gray-700 p-4">{transaction.id}</td>
              <td className="border border-gray-700 p-4">
                {`${transaction.bet || ''}, ${transaction.event || ''}, ${transaction.league || ''}, ${transaction.market || ''}`}
              </td>
              <td className="border border-gray-700 p-4">{transaction.status}</td>
              <td className="border border-gray-700 p-4">{transaction.messageCount || 0}</td>
              <td className="border border-gray-700 p-4">{transaction.amountTotal || 0}</td>
              {showActions && (
                <td className="border border-gray-700 p-4">
                  <button
                    onClick={() => openFillOrderModal(transaction)}
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
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const openFillOrderModal = (transaction) => {
    setSelectedTransaction(transaction);
    setShowModal(true);
  };

  const handleFillOrder = () => {
    if (!selectedTransaction) return;

    const messageData = {
      agentId: agentId,
      transactionId: selectedTransaction.id,
      timestamp: new Date(),
      price: parseFloat(price),
      amount: parseFloat(amount),
      notes,
      type: 'agent_fill',
    };

    addDoc(collection(db, 'messages_agents'), messageData)
      .then(() => {
        console.log('Order filled successfully');
        setShowModal(false);
        setPrice('');
        setAmount('');
        setNotes('');
      })
      .catch((error) => {
        console.error('Error filling order:', error);
      });
  };

  const handleFinishOrder = (transaction) => {
    const messageData = {
      agentId: agentId,
      transactionId: transaction.id,
      timestamp: new Date(),
      message: 'Stopped filling order',
      type: 'agent_finish',
    };
    addDoc(collection(db, 'messages_agents'), messageData)
      .then(() => {
        console.log('Order finished successfully');
      })
      .catch((error) => {
        console.error('Error finishing order:', error);
      });
  };

  return (
    <div className="relative bg-gray-900 text-white p-4 min-h-screen">
      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="absolute top-4 right-4 bg-red-500 text-white p-2 rounded shadow-md hover:bg-red-600"
      >
        Logout
      </button>

      <h1 className="text-3xl font-bold mb-6">Agent Dashboard</h1>
      {agentId && agentName && <h2 className="text-xl mb-4">Welcome, {agentName} (Agent ID: {agentId})</h2>}
      {renderTable('Current Orders', currentOrders)}
      {renderTable('Past Orders', pastOrders, false)}

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded shadow-lg text-white dark:bg-gray-800 dark:text-white">
            <h3 className="text-lg font-bold">Fill Order</h3>
            <div className="mt-4">
              <label className="block mb-2">
                Price:
                <input
                  type="text"
                  value={price}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*\.?\d{0,2}$/.test(value)) {
                      setPrice(value);
                    }
                  }}
                  onBlur={() => {
                    setPrice(parseFloat(price).toFixed(2)); // Format to 2 decimal places on blur
                  }}
                  className="p-2 border border-gray-500 rounded w-full bg-gray-700 text-white"
                />
              </label>
              <label className="block mb-2">
                Amount:
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d*\.?\d{0,2}$/.test(value)) {
                      setAmount(value);
                    }
                  }}
                  onBlur={() => {
                    setAmount(parseFloat(amount).toFixed(2)); // Format to 2 decimal places on blur
                  }}
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
                <button onClick={() => setShowModal(false)} className="bg-gray-500 text-white p-2 rounded">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AgentDashboard;
