import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';

const AgentDashboard = () => {
  const [agentId, setAgentId] = useState(null);
  const [agentName, setAgentName] = useState(null);
  const [currentOrders, setCurrentOrders] = useState([]);
  const [pastOrders, setPastOrders] = useState([]);

  useEffect(() => {
    // Get the current user's UID
    const user = auth.currentUser;
    if (!user) return;
    const userUid = user.uid;
  
    // Set up a real-time listener for agents collection to find the agent ID associated with the user's UID
    const agentsRef = collection(db, 'agents');
    const unsubscribeAgents = onSnapshot(agentsRef, (agentsSnapshot) => {
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
  
        // Set up a real-time listener for transactions collection to find those involving the agent ID
        const transactionsRef = collection(db, 'transactions');
        const unsubscribeTransactions = onSnapshot(transactionsRef, (transactionsSnapshot) => {
          const relevantTransactions = [];
          transactionsSnapshot.forEach((doc) => {
            const transactionData = doc.data();
            if (transactionData.AssignedAgents && transactionData.AssignedAgents.includes(foundAgentId)) {
              relevantTransactions.push({ id: doc.id, ...transactionData });
            }
          });
  
          // Split transactions into current and past orders
          const current = relevantTransactions.filter((transaction) => transaction.status === 'In-Progress');
          const past = relevantTransactions.filter((transaction) => transaction.status !== 'In-Progress');
  
          setCurrentOrders(current);
          setPastOrders(past);
        });
  
        // Cleanup function to unsubscribe from the transactions listener
        return () => unsubscribeTransactions();
      }
    });
  
    // Cleanup function to unsubscribe from the agents listener
    return () => unsubscribeAgents();
  }, []);  

  const renderTable = (title, transactions) => (
    <div>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.id}</td>
              <td>{transaction.amount}</td>
              <td>{transaction.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h1>Agent Dashboard</h1>
      {agentId && agentName && <h2>Welcome, {agentName} (Agent ID: {agentId})</h2>}
      {renderTable('Current Orders', currentOrders)}
      {renderTable('Past Orders', pastOrders)}
    </div>
  );
};

export default AgentDashboard;