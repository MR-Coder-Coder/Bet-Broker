import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';

const AgentDashboard = () => {
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

  const renderTable = (title, transactions, showActions = true) => (
    <div>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Details</th> {/* Updated column to Details */}
            <th>Status</th><th>Message Count</th><th>Amount Total</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.id}</td>
              <td>
                {`${transaction.bet || ''}, ${transaction.event || ''}, ${transaction.league || ''}, ${transaction.market || ''}`}
              </td>
              <td>{transaction.status}</td><td>{transaction.messageCount || 0}</td><td>{transaction.amountTotal || 0}</td>
              {showActions && (<td><button onClick={() => openFillOrderModal(transaction)}>Fill Order</button><button onClick={() => handleFinishOrder(transaction)}>Finish</button></td>)}
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
    <div>
      <h1>Agent Dashboard</h1>
      {agentId && agentName && <h2>Welcome, {agentName} (Agent ID: {agentId})</h2>}
      {renderTable('Current Orders', currentOrders)}
      {renderTable('Past Orders', pastOrders, false)}

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Fill Order</h2>
            <label>
            Price:
            <input
                type="text"
                value={price}
                onChange={(e) => {
                const value = e.target.value;
                // Match numbers with up to two decimal places
                if (/^\d*\.?\d{0,2}$/.test(value)) {
                    setPrice(value);
                }
                }}
                onBlur={() => {
                setPrice(parseFloat(price).toFixed(2)); // Format to 2 decimal places on blur
                }}
            />
            </label>
            <label>
            Amount:
            <input
                type="text"
                value={amount}
                onChange={(e) => {
                const value = e.target.value;
                // Match numbers with up to two decimal places
                if (/^\d*\.?\d{0,2}$/.test(value)) {
                    setAmount(value);
                }
                }}
                onBlur={() => {
                setAmount(parseFloat(amount).toFixed(2)); // Format to 2 decimal places on blur
                }}
            />
            </label>
            <label>
              Notes:
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <button onClick={handleFillOrder}>Submit</button>
            <button onClick={() => setShowModal(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;