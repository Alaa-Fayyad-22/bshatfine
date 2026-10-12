using Bshatfine.Application.Abstractions;
using Bshatfine.Domain.Entities;
using Bshatfine.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Bshatfine.Infrastructure.Persistence.Repositories;

public class NewsRepository(AppDbContext db) : INewsRepository
{
    public Task<List<News>> GetPublishedAsync(int page, int pageSize, CancellationToken ct) =>
        db.News
            .Include(n => n.Translations)
            .AsNoTracking()
            .Where(n => n.Status == NewsStatus.Published)
            .OrderByDescending(n => n.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct) ;

    public Task<List<News>> GetAllAsync(int page, int pageSize, CancellationToken ct) =>
        db.News
            .AsNoTracking()
            .OrderByDescending(n => n.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public Task<News?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.News
            .Include(n => n.Translations)
            .FirstOrDefaultAsync(n => n.Id == id, ct);

    public void Add(News news) => db.News.Add(news);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}