import React from 'react';
import { Construction, Clock, Mail } from 'lucide-react';

const ComingSoon = () => {
  return (
    <div className="min-h-screen w-400 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto text-center">
        {/* Animated Icon */}
        <div className="mb-6">
          <div className="relative inline-block">
            <Construction className="w-16 h-16 text-purple-600 mx-auto mb-3" />
            <div className="absolute -top-2 -right-2">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Main Text */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Coming Soon
        </h1>
        
        <p className="text-[12px] text-gray-600 mb-6 leading-relaxed max-w-md mx-auto">
          We're working hard to bring you something amazing. 
          Stay tuned for updates!
        </p>

        {/* Progress Bar */}
        <div className="w-full max-w-xs bg-gray-200 rounded-full h-1.5 mb-6 mx-auto">
          <div 
            className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full"
            style={{ width: '75%' }}
          ></div>
        </div>

        {/* Features List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6 max-w-2xl mx-auto">
          <div className="bg-white p-3 rounded-lg border border-gray-100">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <span className="text-green-600 text-[10px] font-bold">1</span>
            </div>
            <p className="text-[11px] text-gray-600">Innovative Features</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-100">
            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <span className="text-blue-600 text-[10px] font-bold">2</span>
            </div>
            <p className="text-[11px] text-gray-600">Better Experience</p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-gray-100">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <span className="text-purple-600 text-[10px] font-bold">3</span>
            </div>
            <p className="text-[11px] text-gray-600">Coming Updates</p>
          </div>
        </div>

        {/* Contact Button */}
        <button className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-6 py-2 rounded-lg font-semibold text-[12px] hover:from-purple-600 hover:to-blue-600 transition-all duration-300 flex items-center justify-center gap-2 mx-auto mb-8">
          <Mail className="w-3 h-3" />
          Notify Me
        </button>

        {/* Footer */}
        <div className="mt-8">
          <p className="text-[11px] text-gray-500">
            Follow us for updates • 
            <span className="text-purple-600 font-medium ml-1">
              #ComingSoon
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;