import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ManagerPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [agents, setAgents] = useState([]);
  const [selectedAgents, setSelectedAgents] = useState([]);
  const [betLimit, setBetLimit] = useState('');
  const [seekPrice, setSeekPrice] = useState('');
  const [agentMessage, setAgentMessage] = useState('');

  useEffect(() => {
    // Reference to the transactions collection
    const transactionsRef = collection(db, 'transactions');
    
    // Query to get transactions by different statuses
    const q = query(transactionsRef, where('status', 'in', ['Open', 'In-Progress', 'Closed-UnSettled', 'Closed-Settled', 'Declined']));

    // Set up a real-time listener
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allTransactions = [];
      querySnapshot.forEach((doc) => {
        allTransactions.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(allTransactions);
    });

    // Set up a real-time listener for agents collection
    const agentsRef = collection(db, 'agents');
    const unsubscribeAgents = onSnapshot(agentsRef, (querySnapshot) => {
      const agentList = [];
      querySnapshot.forEach((doc) => {
        agentList.push({ id: doc.id, ...doc.data() });
      });
      setAgents(agentList);
    });

    // Cleanup function to unsubscribe from the listener when the component unmounts
    return () => {
      unsubscribe();
      unsubscribeAgents();
    };
  }, []);

  const handleDecline = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDeclineModal(true);
  };

  const handleAssign = (transaction) => {
    setSelectedTransaction(transaction);
    setBetLimit(transaction.betlimit || '');
    setSeekPrice(transaction.seekprice || '');
    setAgentMessage('');
    setShowAssignModal(true);
  };

  const handleDeclineSubmit = async () => {
    if (selectedTransaction) {
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      await updateDoc(transactionRef, {
        status: 'Declined'
      });

      await addDoc(collection(db, 'messages_client'), {
        transactionId: selectedTransaction.id,
        timestamp: new Date(),
        message: 'Sorry, Cannot fulfill that request'
      });

      setShowDeclineModal(false);
      setSelectedTransaction(null);
    }
  };

  const handleAssignSubmit = async () => {
    if (selectedTransaction) {
      const transactionRef = doc(db, 'transactions', selectedTransaction.id);
      await updateDoc(transactionRef, {
        status: 'In-Progress',
        AssignedAgents: selectedAgents
      });

      for (const agentId of selectedAgents) {
        await addDoc(collection(db, 'messages_agents'), {
          transactionId: selectedTransaction.id,
          timestamp: new Date(),
          AgentId: agentId,
          BetLimit: betLimit,
          SeekPrice: seekPrice,
          message: agentMessage
        });
      }

      setShowAssignModal(false);
      setSelectedTransaction(null);
      setSelectedAgents([]);
    }
  };

  const renderTable = (title, transactions, showAssign, showDecline = true) => (
    <div>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Amount</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.id}</td>
              <td>{transaction.amount}</td>
              <td>
                {showAssign && <button onClick={() => handleAssign(transaction)}>Assign</button>}
                {showDecline && <button onClick={() => handleDecline(transaction)}>Decline</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h1>Manager Dashboard</h1>
      {renderTable('Open Requests', transactions.filter(t => t.status === 'Open'), true)}
      {renderTable('In-Progress', transactions.filter(t => t.status === 'In-Progress'), true)}
      {renderTable('Closed - UnSettled', transactions.filter(t => t.status === 'Closed-UnSettled'), false)}
      {renderTable('Closed - Settled', transactions.filter(t => t.status === 'Closed-Settled'), false)}
      {renderTable('Declined', transactions.filter(t => t.status === 'Declined'), false, false)}

      {/* Decline Modal */}
      {showDeclineModal && (
        <div className="modal">
          <h3>Decline Request</h3>
          <p>Message: "Sorry, Cannot fulfill that request"</p>
          <button onClick={handleDeclineSubmit}>Submit</button>
          <button onClick={() => setShowDeclineModal(false)}>Close</button>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="modal">
          <h3>Assign Request</h3>
          <div>
            <h4>Select Agents</h4>
            {agents.map((agent) => (
              <div key={agent.id}>
                <label>
                  <input
                    type="checkbox"
                    value={agent.id}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAgents((prev) => [...prev, agent.id]);
                      } else {
                        setSelectedAgents((prev) => prev.filter((id) => id !== agent.id));
                      }
                    }}
                  />
                  {agent.name}
                </label>
              </div>
            ))}
          </div>
          <div>
            <label>
              Bet Limit:
              <input
                type="text"
                value={betLimit}
                onChange={(e) => setBetLimit(e.target.value)}
              />
            </label>
          </div>
          <div>
            <label>
              Seek Price:
              <input
                type="text"
                value={seekPrice}
                onChange={(e) => setSeekPrice(e.target.value)}
              />
            </label>
          </div>
          <div>
            <label>
              Message:
              <textarea
                value={agentMessage}
                onChange={(e) => setAgentMessage(e.target.value)}
              />
            </label>
          </div>
          <button onClick={handleAssignSubmit}>Submit</button>
          <button onClick={() => setShowAssignModal(false)}>Close</button>
        </div>
      )}
    </div>
  );
};

export default ManagerPage;