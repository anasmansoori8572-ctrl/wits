import React, { useState, useEffect } from 'react';
import { TestimonialData } from '../types';
import { Quote, Star, MapPin, Sparkles, Plus, Edit3, Trash2, X, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';

interface TestimonialsSectionProps {
  testimonials: TestimonialData[];
  onOpenAdmission?: () => void;
  onUpdateTestimonials?: (newTestimonials: TestimonialData[]) => void;
}

interface MyReviewStored {
  id: string;
  authorKey: string;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({ 
  testimonials, 
  onUpdateTestimonials 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<TestimonialData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestimonialData | null>(null);

  // Form State
  const [studentName, setStudentName] = useState('');
  const [courseName, setCourseName] = useState('Spoken English');
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [testimonial, setTestimonial] = useState('');
  const [city, setCity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Local storage of user's own reviews to allow editing/deleting
  const [myReviews, setMyReviews] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('wits_lingo_my_reviews');
      if (stored) {
        const parsed: MyReviewStored[] = JSON.parse(stored);
        const map: Record<string, string> = {};
        parsed.forEach(item => {
          if (item.id && item.authorKey) map[item.id] = item.authorKey;
        });
        setMyReviews(map);
      }
    } catch (e) {}
  }, []);

  const saveMyReviewAuthorKey = (id: string, authorKey: string) => {
    try {
      const stored = localStorage.getItem('wits_lingo_my_reviews');
      const list: MyReviewStored[] = stored ? JSON.parse(stored) : [];
      const updated = [...list.filter(x => x.id !== id), { id, authorKey }];
      localStorage.setItem('wits_lingo_my_reviews', JSON.stringify(updated));
      setMyReviews(prev => ({ ...prev, [id]: authorKey }));
    } catch (e) {}
  };

  const removeMyReviewAuthorKey = (id: string) => {
    try {
      const stored = localStorage.getItem('wits_lingo_my_reviews');
      const list: MyReviewStored[] = stored ? JSON.parse(stored) : [];
      const updated = list.filter(x => x.id !== id);
      localStorage.setItem('wits_lingo_my_reviews', JSON.stringify(updated));
      setMyReviews(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (e) {}
  };

  const handleOpenWriteModal = () => {
    setEditingReview(null);
    setStudentName('');
    setCourseName('Spoken English');
    setRating(5);
    setHoverRating(0);
    setTestimonial('');
    setCity('');
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (review: TestimonialData) => {
    setEditingReview(review);
    setStudentName(review.studentName);
    setCourseName(review.courseBatch || 'Spoken English');
    setRating(review.rating || 5);
    setHoverRating(0);
    setTestimonial(review.testimonial);
    setCity(review.city || '');
    setFeedbackMsg(null);
    setIsModalOpen(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !testimonial.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please fill in your name and review message.' });
      return;
    }

    setIsSubmitting(true);
    setFeedbackMsg(null);

    try {
      if (editingReview) {
        // Edit existing review
        const authorKey = myReviews[editingReview.id] || editingReview.authorKey;
        const res = await fetch(`/api/reviews/${editingReview.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: studentName.trim(),
            courseBatch: courseName,
            rating,
            testimonial: testimonial.trim(),
            city: city.trim() || 'Verified Learner',
            authorKey
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to update review.');
        }

        const updatedList = testimonials.map(t => t.id === editingReview.id ? data.review : t);
        if (onUpdateTestimonials) onUpdateTestimonials(updatedList);
        setIsModalOpen(false);
      } else {
        // Create new review
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: studentName.trim(),
            courseBatch: courseName,
            rating,
            testimonial: testimonial.trim(),
            city: city.trim() || 'Verified Learner'
          })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to post review.');
        }

        if (data.authorKey && data.review?.id) {
          saveMyReviewAuthorKey(data.review.id, data.authorKey);
        }

        const updatedList = [data.review, ...testimonials];
        if (onUpdateTestimonials) onUpdateTestimonials(updatedList);
        setIsModalOpen(false);
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Error saving review. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const authorKey = myReviews[deleteTarget.id] || deleteTarget.authorKey;

    try {
      const res = await fetch(`/api/reviews/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorKey })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Could not delete review.');
      }

      removeMyReviewAuthorKey(deleteTarget.id);
      const updatedList = testimonials.filter(t => t.id !== deleteTarget.id);
      if (onUpdateTestimonials) onUpdateTestimonials(updatedList);
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.message || 'Error deleting review.');
    }
  };

  // Compute average rating
  const averageRating = testimonials.length > 0
    ? (testimonials.reduce((sum, item) => sum + (item.rating || 5), 0) / testimonials.length).toFixed(1)
    : '5.0';

  const ratingDescriptions: Record<number, string> = {
    1: '1 - Needs Improvement',
    2: '2 - Fair Experience',
    3: '3 - Good & Helpful',
    4: '4 - Very Good Learning',
    5: '5 - Excellent & Highly Recommended!'
  };

  return (
    <section id="testimonials" className="py-20 sm:py-24 bg-white border-b border-slate-200/70">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center space-y-3 mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-purple-50 border border-purple-200/80 text-xs font-bold uppercase tracking-wider text-[#581C87] shadow-2xs">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Student Reviews & Ratings</span>
          </div>
          <h2 className="font-['Outfit'] text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#1E1B26] tracking-tight">
            Real Experiences, Real Confidence
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            Read authentic feedback from learners who conquered their hesitation and speak fluent English with Wits Lingo.
          </p>
        </div>

        {/* Action & Stats Banner: Average Rating + "Write a Review" Button */}
        <div className="bg-[#FAF9FC] rounded-3xl p-6 sm:p-7 border border-purple-100/90 mb-12 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4A1D96] to-[#6B21A8] text-white flex items-center justify-center font-['Outfit'] font-black text-2xl shadow-md shrink-0">
              {averageRating}
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start text-amber-400 gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
                <span className="text-xs font-bold text-slate-800 ml-1.5">{averageRating} out of 5.0</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Based on {testimonials.length} authentic student reviews across all courses
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenWriteModal}
            id="write-review-btn"
            className="w-full sm:w-auto px-6 py-3.5 rounded-full bg-[#4A1D96] hover:bg-[#3B0764] text-white font-bold text-sm tracking-wide shadow-md shadow-purple-900/10 hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Write a Review</span>
          </button>
        </div>

        {/* Testimonials Grid */}
        {testimonials && testimonials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {testimonials.map((item) => {
              const itemRating = item.rating || 5;
              const isMyReview = Boolean(myReviews[item.id]);

              return (
                <div
                  key={item.id}
                  className={`bg-slate-50/70 hover:bg-white rounded-3xl p-6 sm:p-8 border ${
                    isMyReview ? 'border-purple-300 ring-2 ring-purple-200/50 bg-purple-50/20' : 'border-slate-200/80 hover:border-purple-200'
                  } shadow-xs hover:shadow-lg hover:shadow-purple-950/5 transition-all duration-200 flex flex-col justify-between relative group hover:-translate-y-1`}
                >
                  <div className="space-y-4">
                    {/* Card Header: Quote & Star Rating */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-[#4A1D96] flex items-center justify-center shadow-2xs">
                          <Quote className="w-4 h-4" />
                        </div>
                        {isMyReview && (
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-[#4A1D96]">
                            Your Review
                          </span>
                        )}
                      </div>

                      {/* Stars */}
                      <div className="flex text-amber-400 gap-0.5">
                        {[1, 2, 3, 4, 5].map((starIdx) => (
                          <Star 
                            key={starIdx} 
                            className={`w-4 h-4 ${starIdx <= itemRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} 
                          />
                        ))}
                      </div>
                    </div>

                    {/* Testimonial Text */}
                    <p className="text-sm sm:text-[15px] text-slate-700 leading-relaxed italic">
                      “{item.testimonial}”
                    </p>
                  </div>

                  {/* Card Footer: Student Profile + Author Action Buttons */}
                  <div className="pt-5 mt-6 border-t border-slate-200/60 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-[#4A1D96] text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-2xs">
                        {item.studentName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-[#1E1B26] truncate">
                          {item.studentName}
                        </h4>
                        <p className="text-[11px] text-purple-800 font-semibold truncate">
                          {item.courseBatch}
                        </p>
                        {item.city && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{item.city}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Author Edit & Delete Controls */}
                    {isMyReview && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#4A1D96] hover:bg-purple-100/60 transition-colors cursor-pointer"
                          title="Edit your review"
                          aria-label="Edit review"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete your review"
                          aria-label="Delete review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="max-w-md mx-auto text-center p-8 bg-slate-50 rounded-3xl border border-dashed border-slate-200 space-y-3">
            <Sparkles className="w-8 h-8 text-purple-500 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">Be the first to leave a review!</h3>
            <p className="text-xs text-slate-500">
              Share your learning experience with Wits Lingo and inspire new learners.
            </p>
          </div>
        )}

      </div>

      {/* ==================================================================== */}
      {/* WRITE / EDIT REVIEW MODAL                                            */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-100 overflow-hidden">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-[#3B0764] via-[#4A1D96] to-[#6B21A8] text-white p-6 relative">
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              <h3 className="font-['Outfit'] text-xl sm:text-2xl font-black">
                {editingReview ? 'Edit Your Review' : 'Write a Student Review'}
              </h3>
              <p className="text-xs text-purple-200 mt-1">
                Share your genuine feedback to help other students choose their English journey.
              </p>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitReview} className="p-6 space-y-4">
              {feedbackMsg && (
                <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  feedbackMsg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* Student Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Your Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mohd Farhan"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                />
              </div>

              {/* Course Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Course Taken <span className="text-rose-500">*</span>
                </label>
                <select
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#4A1D96] bg-slate-50 cursor-pointer"
                >
                  <option value="Spoken English">Spoken English</option>
                  <option value="English Foundation">English Foundation</option>
                  <option value="English Vocabulary">English Vocabulary</option>
                  <option value="English Conversation">English Conversation</option>
                  <option value="Communication Skills">Communication Skills</option>
                  <option value="General English Masterclass">General English Masterclass</option>
                </select>
              </div>

              {/* Star Rating Interactive Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Your Rating <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs font-bold text-purple-700">
                    {ratingDescriptions[hoverRating || rating]}
                  </span>
                </div>
                <div className="flex items-center gap-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                  {[1, 2, 3, 4, 5].map((starIdx) => {
                    const active = starIdx <= (hoverRating || rating);
                    return (
                      <button
                        key={starIdx}
                        type="button"
                        onClick={() => setRating(starIdx)}
                        onMouseEnter={() => setHoverRating(starIdx)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 cursor-pointer transition-transform hover:scale-110 focus:outline-none"
                      >
                        <Star className={`w-7 h-7 ${active ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Location (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  City / Location <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Amroha, UP or New Delhi"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                />
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Your Review / Experience <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe how the course helped you, what you learned, and your experience with Zia Sir..."
                  value={testimonial}
                  onChange={(e) => setTestimonial(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#4A1D96]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-[#4A1D96] hover:bg-[#3B0764] text-white text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingReview ? 'Update Review' : 'Publish Review'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DELETE CONFIRMATION MODAL                                            */}
      {/* ==================================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 text-center animate-fade-in">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-['Outfit'] font-bold text-lg text-slate-900">Delete Review?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete your review? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
