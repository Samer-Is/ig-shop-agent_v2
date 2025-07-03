import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  Search,
  Filter,
  DollarSign,
  Image,
  Save,
  X,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { ProductCatalogItem } from '../types/merchant';
import { MerchantApiService } from '../services/merchantApi';

const ProductCatalog: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductCatalogItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch merchant data
  const { data: merchantData, isLoading, error } = useQuery({
    queryKey: ['merchantData'],
    queryFn: MerchantApiService.getMerchantData,
  });

  // Update product catalog mutation
  const updateCatalogMutation = useMutation({
    mutationFn: MerchantApiService.updateProductCatalog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchantData'] });
      setToast({ type: 'success', message: 'Product catalog updated successfully!' });
      setIsModalOpen(false);
      setEditingProduct(null);
    },
    onError: (error) => {
      setToast({ type: 'error', message: 'Failed to update product catalog. Please try again.' });
    },
  });

  const products = merchantData?.productCatalog || [];

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: ProductCatalogItem) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDeleteProduct = (productId: string) => {
    const updatedProducts = products.filter(p => p.id !== productId);
    updateCatalogMutation.mutate(updatedProducts);
  };

  const handleSaveProduct = (productData: Partial<ProductCatalogItem>) => {
    let updatedProducts: ProductCatalogItem[];

    if (editingProduct) {
      // Edit existing product
      updatedProducts = products.map(p => 
        p.id === editingProduct.id ? { ...p, ...productData } : p
      );
    } else {
      // Add new product
      const newProduct: ProductCatalogItem = {
        id: Date.now().toString(),
        name: '',
        description: '',
        price: 0,
        currency: 'JOD',
        stock: 0,
        category: '',
        mediaLinks: [],
        isActive: true,
        ...productData,
      };
      updatedProducts = [...products, newProduct];
    }

    updateCatalogMutation.mutate(updatedProducts);
  };

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-700">Failed to load product catalog</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Product Catalog</h3>
        <p className="text-gray-500 mb-4">Coming in Task 3.2 implementation</p>
      </div>
    </div>
  );
};

export default ProductCatalog; 