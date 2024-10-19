import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase'; // Import Firebase
import { useNavigate } from 'react-router-dom';

const Reports = () => {
  const [balances, setBalances] = useState({}); // Stores balance by nomcode
  const [userRole, setUserRole] = useState(''); // Store user role
  const navigate = useNavigate(); // Navigation for back button

  useEffect(() => {
    const fetchUserRole = async () => {
      const user = auth.currentUser;
      if (user) {
        const usersRef = collection(db, 'users');
        const userSnapshot = await getDocs(usersRef);

        // Assuming your Firestore `users` collection stores the role under `role` field
        userSnapshot.forEach((doc) => {
          if (doc.id === user.uid) {
            setUserRole(doc.data().role);
          }
        });
      }
    };

    const fetchPositionsFromAllTransactions = async () => {
      const transactionsRef = collection(db, 'transactions');
      const transactionSnapshot = await getDocs(transactionsRef);
      let allPositionEntries = [];

      for (const transactionDoc of transactionSnapshot.docs) {
        const transactionId = transactionDoc.id;

        try {
          const positionsRef = collection(db, 'transactions', transactionId, 'positions');
          const positionSnapshot = await getDocs(positionsRef);

          if (!positionSnapshot.empty) {
            const positionEntries = positionSnapshot.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                transactionId, // Add the transactionId for reference
                ...data,
              };
            });

            allPositionEntries = [...allPositionEntries, ...positionEntries]; // Append the position entries
          }
        } catch (error) {
          console.error(`Error fetching positions for transaction ${transactionId}:`, error);
        }
      }

      // Group by `nomcode` and accumulate totals for DR, CR, and balance
      const calculatedBalances = {
        Supplier: {},
        Client: {},
        Internal: {},
      };

      allPositionEntries.forEach((entry) => {
        const { nomcode, CR = 0, DR = 0, entity } = entry;

        if (!calculatedBalances[entity][nomcode]) {
          calculatedBalances[entity][nomcode] = {
            nomcode,
            totalDR: 0,
            totalCR: 0,
            balance: 0,
          };
        }

        // Update the totals for each `nomcode`
        calculatedBalances[entity][nomcode].totalDR += parseFloat(DR);
        calculatedBalances[entity][nomcode].totalCR += parseFloat(CR);
        calculatedBalances[entity][nomcode].balance += parseFloat(CR) - parseFloat(DR);
      });

      setBalances(calculatedBalances);
    };

    fetchUserRole();
    fetchPositionsFromAllTransactions();
  }, []);

  const renderTable = (title, data) => (
    <>
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <table className="min-w-full border border-gray-700 mb-8">
        <thead className="bg-gray-800">
          <tr>
            <th className="border border-gray-700 p-4">Nominal Code</th>
            <th className="border border-gray-700 p-4">Total DR</th>
            <th className="border border-gray-700 p-4">Total CR</th>
            <th className="border border-gray-700 p-4">Balance</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(data).map((balanceEntry, index) => (
            <tr key={index}>
              <td className="border border-gray-700 p-4">{balanceEntry.nomcode}</td>
              <td className="border border-gray-700 p-4">{balanceEntry.totalDR}</td>
              <td className="border border-gray-700 p-4">{balanceEntry.totalCR}</td>
              <td className="border border-gray-700 p-4">{balanceEntry.balance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  if (userRole !== 'manager') {
    // If the user is not a manager, redirect or show a message
    return (
      <div className="bg-gray-900 text-white p-6 min-h-screen">
        <h1 className="text-3xl font-bold mb-6">Access Denied</h1>
        <p>You do not have permission to view this page.</p>
        <button
          onClick={() => navigate(-1)}
          className="bg-blue-600 text-white p-2 rounded mt-4"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 text-white p-6 min-h-screen">
      <h1 className="text-4xl font-bold mb-6">Reports Page</h1>
      <h2 className="text-3xl mb-6">Stakeholder Balances</h2>

      {balances.Supplier && Object.keys(balances.Supplier).length > 0 && renderTable('Supplier', balances.Supplier)}
      {balances.Client && Object.keys(balances.Client).length > 0 && renderTable('Client', balances.Client)}
      {balances.Internal && Object.keys(balances.Internal).length > 0 && renderTable('Internal', balances.Internal)}

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="bg-gray-500 text-white p-2 rounded mt-4"
      >
        Go Back
      </button>
    </div>
  );
};

export default Reports;
