namespace Bshatfine.Application.Dtos;

// Public: one language
public record CouncilMemberDto(Guid Id, string Name, string Position, string? PhotoUrl);

public record AdminCouncilMemberDto(
    Guid Id,
    string NameAr,
    string? NameEn,
    string PositionAr,
    string? PositionEn,
    string? PhotoUrl,
    int DisplayOrder,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version);

public record CreateCouncilMemberRequest(string NameAr, string? NameEn, string PositionAr, string? PositionEn);

public record UpdateCouncilMemberRequest(string NameAr, string? NameEn, string PositionAr, string? PositionEn, uint? Version);

// The complete new order: every member's id, exactly once, first to last
public record ReorderCouncilRequest(List<Guid> Ids);